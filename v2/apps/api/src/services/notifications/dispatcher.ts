import { env } from "../../config/env.js";
import { DEFAULT_LANGUAGE } from "../../config/constants.js";
import { isLanguage } from "../../i18n/index.js";
import { clientRequestsModel } from "../../models/client-requests.model.js";
import {
  notificationsModel,
  type EmailSenderRow,
  type NotificationChannelRow,
  type NotificationPayload,
  type RecipientKind,
  type RecipientUser,
} from "../../models/notifications.model.js";
import { outboxModel, type OutboxRow } from "../../models/outbox.model.js";
import { stagesModel } from "../../models/stages.model.js";
import { unitOfWork, type WriteOp } from "../../models/unit-of-work.model.js";
import { workItemsModel } from "../../models/work-items.model.js";
import type { StageRow, WorkItemRow } from "../../types/records.js";
import { catalogCache, type Catalog } from "../catalog-cache.service.js";
import { mailer, mailerConfig } from "./mailer.js";
import { hasTemplate, renderMail, type TemplateContext } from "./templates.js";

const OUTBOX_BATCH = 50;
const OUTBOX_MAX_ATTEMPTS = 5;
const SEND_BATCH = 20;
const SEND_MAX_ATTEMPTS = 3;
const SEND_RETRY_DELAY_MS = 60_000;
export const SMTP_NOT_CONFIGURED = "SMTP no configurado (falta SMTP_PASSWORD)";

const DETAIL_PATH: Record<string, string> = { support: "tickets", task: "tareas", implementation: "implementaciones" };

interface Setup {
  catalog: Catalog;
  emailChannel: NotificationChannelRow | undefined;
  senders: EmailSenderRow[];
  companyName: string;
  brandColor: string;
}

async function loadSetup(): Promise<Setup> {
  const [catalog, channels, senders, settings] = await Promise.all([
    catalogCache.get(),
    notificationsModel.channels(),
    notificationsModel.senders(),
    notificationsModel.settingValues(["general.company_name", "appearance.brand_color"]),
  ]);
  return {
    catalog,
    emailChannel: channels.find((c) => c.channel_type === "email" && c.active),
    senders,
    companyName: typeof settings["general.company_name"] === "string" ? settings["general.company_name"] : "Helpdesk",
    brandColor: typeof settings["appearance.brand_color"] === "string" ? settings["appearance.brand_color"] : "#00387a",
  };
}

function defaultSender(senders: EmailSenderRow[]): EmailSenderRow | undefined {
  return senders.find((s) => s.is_default) ?? senders[0];
}

/** Los clientes solo se enteran de lo que pueden ver en el portal. */
function clientMayReceive(user: RecipientUser, item: WorkItemRow, setup: Setup, eventCode: string, stage: StageRow | null): boolean {
  const eventType = setup.catalog.eventTypes.find((e) => e.code === eventCode);
  const type = setup.catalog.typeById.get(item.type);
  if (!eventType?.client_visible || !type?.client_visible) return false;
  if (user.client !== item.client) return false;
  return !stage || stage.client_visible;
}

async function idsFor(kind: RecipientKind, item: WorkItemRow, payload: OutboxRow["payload"], stage: StageRow | null, actorIsStaff: boolean): Promise<string[]> {
  switch (kind) {
    case "requester":
      return [item.requester];
    case "assignee":
      return [typeof payload.assigneeId === "string" ? payload.assigneeId : item.assignee];
    case "stage_owner":
      return [stage?.owner ?? ""];
    case "client_contacts":
      return notificationsModel.clientContactIds(item.client);
    case "team":
      return notificationsModel.teamMemberIds(item.team);
    case "participants":
      return notificationsModel.participantIds(item.id);
    case "account_manager":
      return [await notificationsModel.accountManagerId(item.client)];
    case "managers":
      // Los jefes se enteran de lo que hacen los clientes o el sistema, no de cada movimiento del equipo.
      return actorIsStaff ? [] : (await notificationsModel.managers()).map((u) => u.id);
  }
}

/** Convierte un evento del outbox en avisos (uno por destinatario y canal). Devuelve las escrituras a aplicar. */
async function fanOut(row: OutboxRow, setup: Setup): Promise<WriteOp[]> {
  const payload = row.payload;
  const eventCode = payload.event;
  if (!setup.emailChannel || !hasTemplate(eventCode)) return [];

  const item = await workItemsModel.findById(payload.workItemId);
  if (!item || item.deleted_at) return [];
  const type = setup.catalog.typeById.get(item.type);
  if (!type) return [];
  // Los cambios automáticos y los de implementaciones ya se avisan con eventos más específicos (etapas, solicitudes).
  if (eventCode === "work_item.status_changed" && (payload.automatic || type.has_stages)) return [];

  const rules = (await notificationsModel.activeRules(row.event_type)).filter(
    (r) => (!r.work_item_type || r.work_item_type === item.type) && r.channels.includes(setup.emailChannel!.id),
  );
  if (!rules.length) return [];

  const request = typeof payload.requestId === "string" ? await clientRequestsModel.findById(payload.requestId) : null;
  const stageId = typeof payload.stageId === "string" ? payload.stageId : request?.stage || "";
  const stage = stageId ? await stagesModel.findById(stageId) : null;
  const [actor] = payload.actorId ? await notificationsModel.usersByIds([payload.actorId]) : [];
  const actorIsStaff = actor?.expand?.role?.scope === "staff";

  const senderByUser = new Map<string, string>();
  for (const rule of rules) {
    for (const kind of rule.recipients) {
      if (eventCode === "work_item.created" && kind === "assignee") continue;
      for (const id of await idsFor(kind, item, payload, stage, actorIsStaff)) {
        if (id && id !== payload.actorId && !senderByUser.has(id)) senderByUser.set(id, rule.sender);
      }
    }
  }
  const muted = await notificationsModel.mutedUserIds(row.event_type, [...senderByUser.keys()]);
  const users = (await notificationsModel.usersByIds([...senderByUser.keys()])).filter(
    (u) =>
      u.email &&
      u.status !== "suspended" &&
      !muted.has(u.id) &&
      (u.expand?.role?.scope !== "client" || clientMayReceive(u, item, setup, eventCode, stage)),
  );
  if (!users.length) return [];

  const fallbackSender = defaultSender(setup.senders);
  const toStatus = typeof payload.to === "string" ? setup.catalog.statusByCode(type.workflow, payload.to) : undefined;
  const base: Omit<TemplateContext, "recipientName" | "statusName"> = {
    actorName: actor?.name ?? "",
    number: item.number,
    title: item.title,
    typeCode: type.code,
    clientName: item.expand?.client?.name ?? "",
    url: `${env.PUBLIC_URL.replace(/\/$/, "")}/${DETAIL_PATH[type.code] ?? "tickets"}/${item.id}`,
    stageName: stage?.name ?? (typeof payload.stage === "string" ? payload.stage : ""),
    requestTitle: request?.title ?? (typeof payload.request === "string" ? payload.request : ""),
    reason: typeof payload.reason === "string" ? payload.reason : "",
    excerpt: typeof payload.excerpt === "string" ? payload.excerpt : "",
    companyName: setup.companyName,
    brandColor: setup.brandColor,
  };

  return users.map((user) => {
    const isClient = user.expand?.role?.scope === "client";
    const language = isLanguage(user.language) ? user.language : DEFAULT_LANGUAGE;
    const statusName = toStatus ? (isClient && toStatus.client_label) || toStatus.name : "";
    const mail = renderMail(eventCode, language, { ...base, recipientName: user.name || user.email, statusName });
    const sender = setup.senders.find((s) => s.id === senderByUser.get(user.id)) ?? fallbackSender;
    const ready = mailerConfig(sender).ready;
    const notificationPayload: NotificationPayload = { to: user.email, ...mail, senderId: sender?.id ?? "", outboxId: row.id };
    return {
      op: "create" as const,
      collection: "notifications",
      data: {
        event_type: row.event_type,
        work_item: item.id,
        recipient: user.id,
        recipient_email: user.email,
        channel: setup.emailChannel!.id,
        status: ready ? "pending" : "skipped",
        attempts: 0,
        last_error: ready ? "" : SMTP_NOT_CONFIGURED,
        payload: notificationPayload,
      },
    };
  });
}

async function processOutbox(setup: Setup): Promise<number> {
  const rows = await outboxModel.due(OUTBOX_BATCH);
  for (const row of rows) {
    try {
      const ops = await fanOut(row, setup);
      // Los avisos y el "entregado" van juntos: si algo falla no quedan avisos duplicados al reintentar.
      ops.push({ op: "update", collection: "event_outbox", id: row.id, data: { status: "delivered", last_error: "" } });
      await unitOfWork.commit(ops);
    } catch (err) {
      await outboxModel.markFailed(row, err instanceof Error ? err.message : String(err), OUTBOX_MAX_ATTEMPTS);
    }
  }
  return rows.length;
}

async function sendPending(setup: Setup): Promise<number> {
  if (!setup.emailChannel) return 0;
  const rows = await notificationsModel.pendingEmails(setup.emailChannel.id, SEND_BATCH, new Date(Date.now() - SEND_RETRY_DELAY_MS));
  for (const row of rows) {
    const sender = setup.senders.find((s) => s.id === row.payload.senderId) ?? defaultSender(setup.senders);
    const config = mailerConfig(sender);
    const attempts = row.attempts + 1;
    if (!config.ready) {
      await notificationsModel.markSkipped(row.id, SMTP_NOT_CONFIGURED);
      continue;
    }
    try {
      await mailer.send(config, row.payload);
      await notificationsModel.markSent(row.id, attempts);
    } catch (err) {
      await notificationsModel.markFailed(row.id, attempts, err instanceof Error ? err.message : String(err), attempts >= SEND_MAX_ATTEMPTS);
    }
  }
  return rows.length;
}

export const notificationDispatcher = {
  /** Una vuelta del worker: procesa eventos nuevos y envía los correos pendientes. */
  async tick(): Promise<{ events: number; sent: number }> {
    const setup = await loadSetup();
    const events = await processOutbox(setup);
    const sent = await sendPending(setup);
    return { events, sent };
  },

  async status() {
    const setup = await loadSetup();
    const sender = defaultSender(setup.senders);
    const config = mailerConfig(sender);
    const [notifications, outbox, recent] = await Promise.all([
      notificationsModel.countByStatus(),
      outboxModel.countByStatus(),
      notificationsModel.recent(15),
    ]);
    return {
      smtp: { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from, ready: config.ready },
      sender: sender ? { id: sender.id, name: sender.name, email: sender.from_email, spfOk: sender.spf_ok, dkimOk: sender.dkim_ok } : null,
      emailChannelActive: Boolean(setup.emailChannel),
      notifications,
      outbox,
      recent: recent.map((n) => ({
        id: n.id,
        to: n.recipient_email,
        subject: n.payload?.subject ?? "",
        status: n.status,
        attempts: n.attempts,
        error: n.last_error,
        created: n.created,
        sentAt: n.sent_at || null,
      })),
    };
  },

  /** Envía un correo de prueba sin pasar por la cola. Devuelve el error del servidor SMTP, si lo hay. */
  async sendTest(to: string): Promise<{ ok: boolean; error?: string; messageId?: string }> {
    const setup = await loadSetup();
    const config = mailerConfig(defaultSender(setup.senders));
    if (!config.ready) return { ok: false, error: SMTP_NOT_CONFIGURED };
    const mail = renderMail("test", DEFAULT_LANGUAGE, {
      recipientName: to,
      actorName: "",
      number: "TEST",
      title: "Correo de prueba",
      typeCode: "support",
      clientName: "",
      url: env.PUBLIC_URL,
      companyName: setup.companyName,
      brandColor: setup.brandColor,
    });
    try {
      const messageId = await mailer.send(config, { to, ...mail, subject: `${setup.companyName}: correo de prueba` });
      return { ok: true, messageId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
