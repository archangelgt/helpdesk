import { ClientResponseError, type RecordModel } from "pocketbase";
import { anyOf, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { CalendarRow } from "../types/records.js";
import type { EmailSenderRow, NotificationRuleRow } from "./notifications.model.js";
import type { WriteOp } from "./unit-of-work.model.js";

export interface SettingRow extends RecordModel {
  key: string;
  group: string;
  value: unknown;
  is_secret: boolean;
  updated_by: string;
}

export interface HolidayListRow extends RecordModel {
  calendar: string;
  day: string;
  name: string;
}

export type RuleWithEvent = NotificationRuleRow & { expand?: { event_type?: { code: string; client_visible: boolean } } };

export const settingsModel = {
  async byKeys(keys: string[]): Promise<SettingRow[]> {
    await ensureAdminAuth();
    return pb.collection("settings").getFullList<SettingRow>({ filter: anyOf("key", keys) });
  },

  /** Escrituras para guardar valores y su historial (sin secretos) en un mismo batch. */
  changeOps(current: SettingRow[], changes: { key: string; group: string; value: unknown }[], userId: string): WriteOp[] {
    const ops: WriteOp[] = [];
    for (const change of changes) {
      const row = current.find((r) => r.key === change.key);
      if (row && JSON.stringify(row.value) === JSON.stringify(change.value)) continue;
      if (row) {
        ops.push({ op: "update", collection: "settings", id: row.id, data: { value: change.value, updated_by: userId } });
        ops.push({
          op: "create",
          collection: "settings_history",
          data: { setting: row.id, old_value: row.is_secret ? null : row.value, new_value: row.is_secret ? null : change.value, changed_by: userId },
        });
      } else {
        ops.push({ op: "create", collection: "settings", data: { key: change.key, group: change.group, value: change.value, is_secret: false, updated_by: userId } });
      }
    }
    return ops;
  },

  async rules(): Promise<RuleWithEvent[]> {
    await ensureAdminAuth();
    return pb.collection("notification_rules").getFullList<RuleWithEvent>({ expand: "event_type", sort: "created" });
  },

  async findRule(id: string): Promise<NotificationRuleRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection("notification_rules").getOne<NotificationRuleRow>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  async updateRule(id: string, data: Partial<Pick<NotificationRuleRow, "recipients" | "active">>): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("notification_rules").update(id, data);
  },

  async defaultSender(): Promise<EmailSenderRow | null> {
    await ensureAdminAuth();
    const res = await pb.collection("email_senders").getList<EmailSenderRow>(1, 1, { filter: "active = true", sort: "-is_default,name" });
    return res.items[0] ?? null;
  },

  async updateSender(id: string, data: Partial<Pick<EmailSenderRow, "name" | "from_email" | "reply_to">>): Promise<EmailSenderRow> {
    await ensureAdminAuth();
    return pb.collection("email_senders").update<EmailSenderRow>(id, data);
  },

  async defaultCalendar(): Promise<(CalendarRow & { name: string }) | null> {
    await ensureAdminAuth();
    const res = await pb.collection("business_calendars").getList<CalendarRow & { name: string }>(1, 1, { filter: "is_default = true" });
    return res.items[0] ?? null;
  },

  async updateCalendar(id: string, data: Partial<Pick<CalendarRow, "working_hours" | "timezone">>): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("business_calendars").update(id, data);
  },

  async holidays(calendarId: string): Promise<HolidayListRow[]> {
    await ensureAdminAuth();
    return pb.collection("holidays").getFullList<HolidayListRow>({ filter: pb.filter("calendar = {:id}", { id: calendarId }), sort: "day" });
  },

  async findHoliday(id: string): Promise<HolidayListRow | null> {
    await ensureAdminAuth();
    try {
      return await pb.collection("holidays").getOne<HolidayListRow>(id);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  async holidayOn(calendarId: string, day: string): Promise<HolidayListRow | null> {
    await ensureAdminAuth();
    const res = await pb.collection("holidays").getList<HolidayListRow>(1, 1, {
      filter: pb.filter("calendar = {:c} && day >= {:from} && day <= {:to}", { c: calendarId, from: `${day} 00:00:00.000Z`, to: `${day} 23:59:59.999Z` }),
    });
    return res.items[0] ?? null;
  },

  async createHoliday(data: { calendar: string; day: string; name: string }): Promise<HolidayListRow> {
    await ensureAdminAuth();
    return pb.collection("holidays").create<HolidayListRow>(data);
  },

  async deleteHoliday(id: string): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("holidays").delete(id);
  },
};
