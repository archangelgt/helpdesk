import type { RecordModel } from "pocketbase";
import { anyOf, ensureAdminAuth, pb, pbDate } from "../db/pocketbase.js";
import type { UserRow } from "../types/records.js";

export type RecipientKind =
  | "requester"
  | "client_contacts"
  | "assignee"
  | "stage_owner"
  | "team"
  | "managers"
  | "participants"
  | "account_manager";

export interface NotificationRuleRow extends RecordModel {
  event_type: string;
  work_item_type: string;
  recipients: RecipientKind[];
  channels: string[];
  sender: string;
  active: boolean;
}

export interface NotificationChannelRow extends RecordModel {
  code: string;
  name: string;
  channel_type: string;
  active: boolean;
}

export interface EmailSenderRow extends RecordModel {
  name: string;
  from_email: string;
  reply_to: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  spf_ok: boolean;
  dkim_ok: boolean;
  is_default: boolean;
  active: boolean;
}

export interface NotificationPayload {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  senderId: string;
  /** Eventos del outbox que juntó este correo (una misma acción puede generar varios). */
  outboxIds: string[];
  events: string[];
}

export interface NotificationRow extends RecordModel {
  event_type: string;
  work_item: string;
  recipient: string;
  recipient_email: string;
  channel: string;
  status: "pending" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string;
  sent_at: string;
  payload: NotificationPayload;
  created: string;
}

export type RecipientUser = UserRow & { language: string; expand?: { role?: { code: string; scope: string } } };

const USER_FIELDS = "id,name,email,role,client,status,language,expand.role.code,expand.role.scope";

export const notificationsModel = {
  async activeRules(eventTypeId: string): Promise<NotificationRuleRow[]> {
    await ensureAdminAuth();
    return pb.collection("notification_rules").getFullList<NotificationRuleRow>({
      filter: pb.filter("event_type = {:eventTypeId} && active = true", { eventTypeId }),
    });
  },

  async channels(): Promise<NotificationChannelRow[]> {
    await ensureAdminAuth();
    return pb.collection("notification_channels").getFullList<NotificationChannelRow>({ sort: "code" });
  },

  async senders(): Promise<EmailSenderRow[]> {
    await ensureAdminAuth();
    return pb.collection("email_senders").getFullList<EmailSenderRow>({ filter: "active = true", sort: "-is_default,name" });
  },

  async usersByIds(ids: string[]): Promise<RecipientUser[]> {
    if (!ids.length) return [];
    await ensureAdminAuth();
    return pb.collection("users").getFullList<RecipientUser>({ filter: anyOf("id", ids), expand: "role", fields: USER_FIELDS });
  },

  async managers(): Promise<RecipientUser[]> {
    await ensureAdminAuth();
    return pb.collection("users").getFullList<RecipientUser>({
      filter: "status != 'suspended' && (role.code = 'owner' || role.code = 'manager')",
      expand: "role",
      fields: USER_FIELDS,
    });
  },

  /** Contactos del cliente que reciben avisos; si no hay ninguno configurado, sus administradores. */
  async clientContactIds(clientId: string): Promise<string[]> {
    if (!clientId) return [];
    await ensureAdminAuth();
    const contacts = await pb.collection("client_contacts").getFullList<RecordModel & { user: string }>({
      filter: pb.filter("client = {:clientId} && receives_notifications = true", { clientId }),
      fields: "user",
    });
    if (contacts.length) return contacts.map((c) => c.user);
    const admins = await pb.collection("users").getFullList<RecordModel>({
      filter: pb.filter("client = {:clientId} && status != 'suspended' && role.code = 'client_admin'", { clientId }),
      fields: "id",
    });
    return admins.map((u) => u.id);
  },

  async teamMemberIds(teamId: string): Promise<string[]> {
    if (!teamId) return [];
    await ensureAdminAuth();
    const rows = await pb.collection("team_members").getFullList<RecordModel & { user: string }>({
      filter: pb.filter("team = {:teamId}", { teamId }),
      fields: "user",
    });
    return rows.map((r) => r.user);
  },

  async participantIds(workItemId: string): Promise<string[]> {
    await ensureAdminAuth();
    const rows = await pb.collection("work_item_participants").getFullList<RecordModel & { user: string }>({
      filter: pb.filter("work_item = {:workItemId} && receives_notifications = true", { workItemId }),
      fields: "user",
    });
    return rows.map((r) => r.user);
  },

  async accountManagerId(clientId: string): Promise<string> {
    if (!clientId) return "";
    await ensureAdminAuth();
    try {
      const client = await pb.collection("clients").getOne<RecordModel & { account_manager: string }>(clientId, { fields: "account_manager" });
      return client.account_manager ?? "";
    } catch {
      return "";
    }
  },

  /** Usuarios que silenciaron este tipo de evento. */
  async mutedUserIds(eventTypeId: string, userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    await ensureAdminAuth();
    const rows = await pb.collection("user_notification_prefs").getFullList<RecordModel & { user: string }>({
      filter: `${pb.filter("event_type = {:eventTypeId} && muted = true", { eventTypeId })} && ${anyOf("user", userIds)}`,
      fields: "user",
    });
    return new Set(rows.map((r) => r.user));
  },

  async settingValues(keys: string[]): Promise<Record<string, unknown>> {
    await ensureAdminAuth();
    const rows = await pb.collection("settings").getFullList<RecordModel & { key: string; value: unknown }>({
      filter: anyOf("key", keys),
      fields: "key,value",
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  /** Pendientes de enviar; los que ya fallaron esperan hasta `retryBefore` antes de reintentarse. */
  async pendingEmails(channelId: string, limit: number, retryBefore: Date): Promise<NotificationRow[]> {
    await ensureAdminAuth();
    const res = await pb.collection("notifications").getList<NotificationRow>(1, limit, {
      filter: pb.filter("status = 'pending' && channel = {:channelId} && (attempts = 0 || updated <= {:cutoff})", {
        channelId,
        cutoff: pbDate(retryBefore),
      }),
      sort: "created",
    });
    return res.items;
  },

  async markSkipped(id: string, reason: string): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("notifications").update(id, { status: "skipped", last_error: reason });
  },

  async markSent(id: string, attempts: number): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("notifications").update(id, { status: "sent", attempts, sent_at: pbDate(new Date()), last_error: "" });
  },

  async markFailed(id: string, attempts: number, error: string, final: boolean): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("notifications").update(id, { status: final ? "failed" : "pending", attempts, last_error: error.slice(0, 2000) });
  },

  async countByStatus(): Promise<Record<NotificationRow["status"], number>> {
    await ensureAdminAuth();
    const statuses: NotificationRow["status"][] = ["pending", "sent", "failed", "skipped"];
    const counts = await Promise.all(
      statuses.map((status) =>
        pb.collection("notifications").getList(1, 1, { filter: pb.filter("status = {:status}", { status }), fields: "id", skipTotal: false }),
      ),
    );
    return Object.fromEntries(statuses.map((s, i) => [s, counts[i].totalItems])) as Record<NotificationRow["status"], number>;
  },

  async recent(limit: number): Promise<NotificationRow[]> {
    await ensureAdminAuth();
    const res = await pb.collection("notifications").getList<NotificationRow>(1, limit, { sort: "-created" });
    return res.items;
  },
};
