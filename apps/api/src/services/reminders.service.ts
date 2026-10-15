import { env } from "../config/env.js";
import { pbDate } from "../db/pocketbase.js";
import { clientRequestsModel } from "../models/client-requests.model.js";
import { remindersModel, type ReminderRequestRow } from "../models/reminders.model.js";
import { templatesModel } from "../models/templates.model.js";
import { unitOfWork, type WriteOp } from "../models/unit-of-work.model.js";
import { buildCalendar, isBusinessDay, parseDay, toDay, type WorkCalendar } from "../utils/business-days.js";
import { Errors } from "../utils/errors.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";
import { eventOps, type DomainEvent } from "./events.js";
import { settingsService, type ReminderPolicy } from "./settings.service.js";
import { loadVisibleWorkItem } from "./work-items.service.js";

export type ReminderKind = "due_soon" | "due_today" | "overdue";

export interface ReminderRun {
  day: string;
  skipped: boolean;
  requests: number;
  stages: number;
  items: number;
}

/** Día calendario (YYYY-MM-DD) de un instante en la zona horaria de la empresa. */
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function localHour(at: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(at));
}

function shift(day: string, delta: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + delta);
  return toDay(d);
}

/** El día hábil que queda `n` días hábiles antes de `day`. */
function businessDaysBefore(day: string, n: number, cal: WorkCalendar): string {
  let current = day;
  for (let moved = 0, guard = 0; moved < n && guard < 400; guard++) {
    current = shift(current, -1);
    if (isBusinessDay(current, cal)) moved++;
  }
  return current;
}

/** Días hábiles desde `from` (excluido) hasta `to` (incluido). */
function businessDaysBetween(from: string, to: string, cal: WorkCalendar): number {
  let count = 0;
  for (let current = from, guard = 0; current < to && guard < 400; guard++) {
    current = shift(current, 1);
    if (isBusinessDay(current, cal)) count++;
  }
  return count;
}

const calendarDays = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);

/**
 * Qué recordatorio toca hoy para un requerimiento, o null. `lastDay` es el día del último recordatorio enviado.
 * Antes de vencer: una vez, `beforeDueDays` días hábiles antes. El día del vencimiento: una vez (si `onDue`).
 * Vencido: al día siguiente y luego cada `everyDaysAfter` días hábiles, hasta `maxReminders` en total.
 */
export function reminderFor(
  request: { dueDay: string; lastDay: string | null; sent: number },
  today: string,
  policy: ReminderPolicy,
  cal: WorkCalendar,
): ReminderKind | null {
  const { dueDay, lastDay, sent } = request;
  if (sent >= policy.maxReminders) return null;
  if (today < dueDay) {
    if (policy.beforeDueDays <= 0) return null;
    const from = businessDaysBefore(dueDay, policy.beforeDueDays, cal);
    return today >= from && (!lastDay || lastDay < from) ? "due_soon" : null;
  }
  if (today === dueDay) return policy.onDue && (!lastDay || lastDay < dueDay) ? "due_today" : null;
  if (!lastDay || lastDay <= dueDay) return "overdue";
  return policy.everyDaysAfter > 0 && businessDaysBetween(lastDay, today, cal) >= policy.everyDaysAfter ? "overdue" : null;
}

async function workCalendar(): Promise<WorkCalendar> {
  const { calendar, holidays } = await templatesModel.defaultCalendar();
  return buildCalendar(calendar?.working_hours ?? null, holidays);
}

function requestEvent(request: ReminderRequestRow, kind: ReminderKind | "manual", today: string, actorId: string | null): DomainEvent {
  const dueDay = request.due_at ? request.due_at.slice(0, 10) : null;
  return {
    code: kind === "overdue" ? "client_request.overdue" : "client_request.reminder",
    workItemId: request.work_item,
    actorId,
    data: {
      requestId: request.id,
      stageId: request.stage || null,
      request: request.title,
      dueDay,
      kind,
      ...(kind === "overdue" && dueDay ? { daysLate: calendarDays(dueDay, today) } : {}),
    },
  };
}

const reminderUpdate = (request: ReminderRequestRow): WriteOp => ({
  op: "update",
  collection: "client_requests",
  id: request.id,
  data: { reminders_sent: (request.reminders_sent ?? 0) + 1, last_reminder_at: pbDate(new Date()) },
});

/** Pasada del worker: deja en el outbox los avisos de vencimientos; el envío lo hace el dispatcher. */
async function run(now: Date, force: boolean): Promise<ReminderRun> {
  const settings = await settingsService.current();
  const today = localDay(now, settings.timezone);
  const cal = await workCalendar();
  if (!force && (!isBusinessDay(today, cal) || localHour(now, settings.timezone) < env.REMINDERS_FROM_HOUR)) {
    return { day: today, skipped: true, requests: 0, stages: 0, items: 0 };
  }
  const policy = settings.reminders;

  const byItem = new Map<string, { ops: WriteOp[]; events: DomainEvent[] }>();
  const add = (workItemId: string, op: WriteOp, event: DomainEvent) => {
    const entry = byItem.get(workItemId) ?? { ops: [], events: [] };
    entry.ops.push(op);
    entry.events.push(event);
    byItem.set(workItemId, entry);
  };

  let requests = 0;
  const lookahead = policy.beforeDueDays > 0 ? shift(today, policy.beforeDueDays + 14) : today;
  for (const request of await remindersModel.requestsDueBy(lookahead)) {
    const kind = reminderFor(
      {
        dueDay: request.due_at.slice(0, 10),
        lastDay: request.last_reminder_at ? localDay(new Date(request.last_reminder_at), settings.timezone) : null,
        sent: request.reminders_sent ?? 0,
      },
      today,
      policy,
      cal,
    );
    if (!kind) continue;
    add(request.work_item, reminderUpdate(request), requestEvent(request, kind, today, null));
    requests++;
  }

  const notified = pbDate(now);
  const stages = await remindersModel.overdueStages(today);
  for (const stage of stages) {
    const dueDay = stage.planned_end.slice(0, 10);
    add(
      stage.work_item,
      { op: "update", collection: "stages", id: stage.id, data: { overdue_notified_at: notified } },
      { code: "stage.overdue", workItemId: stage.work_item, actorId: null, data: { stageId: stage.id, stage: stage.name, dueDay, daysLate: calendarDays(dueDay, today) } },
    );
  }

  const items = await remindersModel.overdueItems(today);
  for (const item of items) {
    const dueDay = item.due_at.slice(0, 10);
    add(
      item.id,
      { op: "update", collection: "work_items", id: item.id, data: { overdue_notified_at: notified } },
      { code: "sla.breached", workItemId: item.id, actorId: null, data: { metric: "due", dueDay, daysLate: calendarDays(dueDay, today) } },
    );
  }

  if (byItem.size) {
    const catalog = await catalogCache.get();
    // Un batch por caso: si uno falla, los demás igual salen y el fallido se reintenta en la próxima pasada.
    for (const { ops, events } of byItem.values()) await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
  }
  return { day: today, skipped: false, requests, stages: stages.length, items: items.length };
}

let lastRun = 0;

export const remindersService = {
  reminderFor,

  /** Desde el worker: como máximo cada REMINDERS_INTERVAL_MINUTES (0 = apagado). */
  async tick(now = new Date()): Promise<ReminderRun | null> {
    const every = env.REMINDERS_INTERVAL_MINUTES * 60_000;
    if (!every || now.getTime() - lastRun < every) return null;
    lastRun = now.getTime();
    return run(now, false);
  },

  /** Desde Configuración: revisa los vencimientos ahora, aunque sea fuera de horario. */
  async runNow(actor: Actor): Promise<ReminderRun> {
    assertCan(actor, "settings.manage");
    return run(new Date(), true);
  },

  /** Recordatorio manual de un requerimiento desde el caso. */
  async remind(actor: Actor, requestId: string): Promise<{ remindersSent: number }> {
    assertCan(actor, "client_request.create");
    if (actor.isClient) throw Errors.forbidden();
    const request = await clientRequestsModel.findById(requestId);
    if (!request || request.status === "cancelled") throw Errors.notFound();
    await loadVisibleWorkItem(actor, request.work_item);
    if (!["pending", "rejected"].includes(request.status)) throw Errors.conflict("client_request.invalid_state");
    const settings = await settingsService.current();
    const catalog = await catalogCache.get();
    const event = requestEvent(request, "manual", localDay(new Date(), settings.timezone), actor.userId);
    await unitOfWork.commit([reminderUpdate(request), ...eventOps(catalog, [event])]);
    return { remindersSent: (request.reminders_sent ?? 0) + 1 };
  },
};
