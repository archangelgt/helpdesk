import { reportsModel, type ReportItemRow, type ReportScope, type ReportStageRow } from "../models/reports.model.js";
import { DONE_CATEGORIES, OPEN_CATEGORIES } from "../types/records.js";
import { Errors } from "../utils/errors.js";
import type { ReportQuery } from "../validators/reports.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";

const HOUR = 3_600_000;
const DAY = 86_400_000;

const ts = (value: string) => (value ? Date.parse(value.replace(" ", "T")) : NaN);
const inRange = (value: string, s: ReportScope) => {
  const t = ts(value);
  return t >= s.from.getTime() && t <= s.to.getTime();
};
const isOpen = (i: ReportItemRow) => OPEN_CATEGORIES.includes(i.status_category);
const isDone = (i: ReportItemRow) => DONE_CATEGORIES.includes(i.status_category);
const resolvedIn = (i: ReportItemRow, s: ReportScope) => isDone(i) && inRange(i.resolved_at || i.closed_at, s);
const overdue = (i: ReportItemRow, now: number) => isOpen(i) && Boolean(i.due_at) && ts(i.due_at) < now;

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
const resolutionHours = (i: ReportItemRow) => (ts(i.resolved_at || i.closed_at) - ts(i.created)) / HOUR;

/** Días de atraso de una etapa: hasta hoy si sigue abierta, hasta que se completó si ya terminó. */
function stageDelayDays(stage: ReportStageRow, now: number): number {
  if (!stage.planned_end) return 0;
  const plannedEnd = Date.parse(`${stage.planned_end.slice(0, 10)}T23:59:59Z`);
  const end = stage.completed_at ? ts(stage.completed_at) : now;
  return end > plannedEnd ? Math.ceil((end - plannedEnd) / DAY) : 0;
}

function resolveScope(q: ReportQuery): ReportScope {
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
  const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(to.getTime() - (q.days ?? 30) * DAY);
  if (from > to) throw Errors.validation([{ field: "from", code: "reports.invalid_range", message: "" }]);
  if (to.getTime() - from.getTime() > 731 * DAY) throw Errors.validation([{ field: "from", code: "reports.range_too_long", message: "" }]);
  return { from, to, clientId: q.clientId, typeId: q.typeId };
}

/** Cubetas diarias (hasta 62 días) o semanales para la gráfica de tendencia. */
function buckets(s: ReportScope): { start: number; label: string }[] {
  const span = s.to.getTime() - s.from.getTime();
  const step = span <= 62 * DAY ? DAY : 7 * DAY;
  const out: { start: number; label: string }[] = [];
  const first = Date.UTC(s.from.getUTCFullYear(), s.from.getUTCMonth(), s.from.getUTCDate());
  for (let t = first; t <= s.to.getTime(); t += step) out.push({ start: t, label: new Date(t).toISOString().slice(0, 10) });
  return out;
}

export const reportsService = {
  async overview(actor: Actor, query: ReportQuery) {
    if (actor.isClient) throw Errors.forbidden();
    assertCan(actor, "report.view");
    const scope = resolveScope(query);
    const now = Date.now();
    const catalog = await catalogCache.get();

    const [items, requests, rejections] = await Promise.all([
      reportsModel.workItems(scope),
      reportsModel.clientRequests(scope),
      reportsModel.rejectionsByClient(scope),
    ]);
    const implTypeIds = new Set(catalog.types.filter((t) => t.has_stages).map((t) => t.id));
    const implementations = items.filter((i) => implTypeIds.has(i.type));
    const stages = await reportsModel.stages(implementations.map((i) => i.id));
    const userNames = await reportsModel.names("users", [
      ...items.flatMap((i) => [i.assignee, i.requester]),
      ...stages.map((s) => s.completed_by),
    ]);
    const clientNames = await reportsModel.names("clients", [...items.map((i) => i.client), ...requests.map((r) => r.expand?.work_item?.client ?? "")]);

    const created = items.filter((i) => inRange(i.created, scope));
    const resolved = items.filter((i) => resolvedIn(i, scope));
    const open = items.filter(isOpen);

    const summary = {
      created: created.length,
      resolved: resolved.length,
      open: open.length,
      overdue: open.filter((i) => overdue(i, now)).length,
      unassigned: open.filter((i) => !i.assignee).length,
      waitingClient: open.filter((i) => i.status_category === "waiting_client").length,
      avgFirstResponseHours: average(created.filter((i) => i.first_response_at).map((i) => (ts(i.first_response_at) - ts(i.created)) / HOUR)),
      avgResolutionHours: average(resolved.map(resolutionHours)),
    };

    const byType = catalog.types
      .filter((t) => t.active)
      .map((t) => {
        const of = (list: ReportItemRow[]) => list.filter((i) => i.type === t.id);
        return {
          typeId: t.id,
          code: t.code,
          name: t.name,
          created: of(created).length,
          resolved: of(resolved).length,
          open: of(open).length,
          overdue: of(open).filter((i) => overdue(i, now)).length,
          avgResolutionHours: average(of(resolved).map(resolutionHours)),
        };
      });

    const trend = buckets(scope).map((b, idx, all) => {
      const end = all[idx + 1]?.start ?? Infinity;
      const within = (v: string) => {
        const t = ts(v);
        return t >= b.start && t < end;
      };
      return {
        date: b.label,
        created: created.filter((i) => within(i.created)).length,
        resolved: resolved.filter((i) => within(i.resolved_at || i.closed_at)).length,
      };
    });

    const clientIds = [...new Set(items.map((i) => i.client).filter(Boolean))];
    const byClient = clientIds
      .map((id) => {
        const of = (list: ReportItemRow[]) => list.filter((i) => i.client === id);
        return {
          clientId: id,
          name: clientNames.get(id) ?? "—",
          created: of(created).length,
          resolved: of(resolved).length,
          open: of(open).length,
          overdue: of(open).filter((i) => overdue(i, now)).length,
        };
      })
      .sort((a, b) => b.created - a.created || b.open - a.open);

    const clientUsers = await reportsModel.clientUserIds(stages.map((s) => s.completed_by));
    const stagesCompleted = new Map<string, number>();
    for (const s of stages) {
      if (s.completed_by && !clientUsers.has(s.completed_by) && inRange(s.completed_at, scope)) {
        stagesCompleted.set(s.completed_by, (stagesCompleted.get(s.completed_by) ?? 0) + 1);
      }
    }
    const assigneeIds = [...new Set([...items.map((i) => i.assignee).filter(Boolean), ...stagesCompleted.keys()])];
    const byAssignee = assigneeIds
      .map((id) => {
        const of = (list: ReportItemRow[]) => list.filter((i) => i.assignee === id);
        return {
          userId: id,
          name: userNames.get(id) ?? "—",
          open: of(open).length,
          overdue: of(open).filter((i) => overdue(i, now)).length,
          resolved: of(resolved).length,
          avgResolutionHours: average(of(resolved).map(resolutionHours)),
          stagesCompleted: stagesCompleted.get(id) ?? 0,
        };
      })
      .sort((a, b) => b.resolved - a.resolved || b.open - a.open);
    const unassignedOpen = open.filter((i) => !i.assignee).length;

    const requesterCounts = new Map<string, { count: number; client: string }>();
    for (const i of created) {
      if (!i.requester) continue;
      const entry = requesterCounts.get(i.requester) ?? { count: 0, client: i.client };
      entry.count += 1;
      requesterCounts.set(i.requester, entry);
    }
    const byRequester = [...requesterCounts.entries()]
      .map(([id, v]) => ({ userId: id, name: userNames.get(id) ?? "—", clientName: v.client ? (clientNames.get(v.client) ?? null) : null, created: v.count }))
      .sort((a, b) => b.created - a.created)
      .slice(0, 10);

    const stagesByItem = new Map<string, ReportStageRow[]>();
    for (const s of stages) stagesByItem.set(s.work_item, [...(stagesByItem.get(s.work_item) ?? []), s]);
    const requestsByItem = new Map<string, typeof requests>();
    for (const r of requests) requestsByItem.set(r.work_item, [...(requestsByItem.get(r.work_item) ?? []), r]);
    const isRequestOpen = (r: (typeof requests)[number]) => r.status === "pending" || r.status === "rejected";

    const implRows = implementations
      .filter((i) => isOpen(i) || resolvedIn(i, scope))
      .map((i) => {
        const own = stagesByItem.get(i.id) ?? [];
        const delays = { client: 0, internal: 0 };
        let delayedStages = 0;
        for (const s of own) {
          const days = stageDelayDays(s, now);
          if (!days) continue;
          if (!s.completed_at) delayedStages += 1;
          if (s.responsible_side === "client") delays.client += days;
          else if (s.responsible_side === "shared") {
            delays.client += days / 2;
            delays.internal += days / 2;
          } else delays.internal += days;
        }
        const reqs = requestsByItem.get(i.id) ?? [];
        return {
          id: i.id,
          number: i.number,
          title: i.title,
          clientName: i.client ? (clientNames.get(i.client) ?? null) : null,
          assigneeName: i.assignee ? (userNames.get(i.assignee) ?? null) : null,
          statusCategory: i.status_category,
          progress: Math.round(i.progress_percent || 0),
          dueAt: i.due_at || null,
          stagesTotal: own.length,
          stagesDone: own.filter((s) => s.completed_at).length,
          delayedStages,
          clientDelayDays: Math.round(delays.client),
          internalDelayDays: Math.round(delays.internal),
          pendingRequests: reqs.filter(isRequestOpen).length,
          overdueRequests: reqs.filter((r) => isRequestOpen(r) && r.due_at && ts(r.due_at) < now).length,
        };
      })
      .sort((a, b) => b.clientDelayDays + b.internalDelayDays - (a.clientDelayDays + a.internalDelayDays));
    const implementationTotals = {
      active: implRows.filter((r) => OPEN_CATEGORIES.includes(r.statusCategory)).length,
      delayed: implRows.filter((r) => r.delayedStages > 0).length,
      avgProgress: average(implRows.filter((r) => OPEN_CATEGORIES.includes(r.statusCategory)).map((r) => r.progress)),
      clientDelayDays: implRows.reduce((a, r) => a + r.clientDelayDays, 0),
      internalDelayDays: implRows.reduce((a, r) => a + r.internalDelayDays, 0),
    };

    const requestClients = [...new Set(requests.map((r) => r.expand?.work_item?.client ?? "").filter(Boolean))];
    const clientRequests = requestClients
      .map((id) => {
        const own = requests.filter((r) => r.expand?.work_item?.client === id);
        const delivered = own.filter((r) => r.submitted_at && inRange(r.created, scope));
        return {
          clientId: id,
          name: clientNames.get(id) ?? "—",
          pending: own.filter(isRequestOpen).length,
          overdue: own.filter((r) => isRequestOpen(r) && r.due_at && ts(r.due_at) < now).length,
          inReview: own.filter((r) => r.status === "submitted" || r.status === "in_review").length,
          avgDeliveryDays: average(delivered.map((r) => (ts(r.submitted_at) - ts(r.created)) / DAY)),
          rejected: rejections.get(id) ?? 0,
        };
      })
      .sort((a, b) => b.overdue - a.overdue || b.pending - a.pending);

    return {
      period: { from: scope.from.toISOString(), to: scope.to.toISOString() },
      summary,
      byType,
      trend,
      byClient,
      byAssignee,
      unassignedOpen,
      byRequester,
      implementations: { totals: implementationTotals, items: implRows },
      clientRequests,
    };
  },
};
