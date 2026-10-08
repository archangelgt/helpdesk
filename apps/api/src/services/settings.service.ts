import { DEFAULT_LANGUAGE, LANGUAGES, THEMES, type Language } from "../config/constants.js";
import type { RecipientKind } from "../models/notifications.model.js";
import { settingsModel } from "../models/settings.model.js";
import { unitOfWork } from "../models/unit-of-work.model.js";
import { dayToPb } from "../utils/business-days.js";
import { Errors } from "../utils/errors.js";
import type {
  HolidayInput,
  SenderInput,
  SettingsPatch,
  UpdateRuleInput,
  WorkingDaysInput,
} from "../validators/settings.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { MAX_ATTACHMENT_BYTES } from "./attachment-rules.js";

/** Claves que se editan desde Configuración, con su grupo y valor por defecto. */
const DEFINITIONS = {
  "general.company_name": { group: "general", fallback: "Helpdesk" },
  "general.timezone": { group: "general", fallback: "America/Guatemala" },
  "appearance.theme": { group: "appearance", fallback: "blue" },
  "appearance.color_mode": { group: "appearance", fallback: "system" },
  "appearance.brand_color": { group: "appearance", fallback: "#00387a" },
  "language.default": { group: "language", fallback: DEFAULT_LANGUAGE },
  "language.available": { group: "language", fallback: [...LANGUAGES] },
  "files.max_upload_mb": { group: "files", fallback: MAX_ATTACHMENT_BYTES / 1024 / 1024 },
} as const;
type SettingKey = keyof typeof DEFINITIONS;
const KEYS = Object.keys(DEFINITIONS) as SettingKey[];

/** Campo del cuerpo de la API → clave en `settings`. */
const FIELD_KEYS: Record<keyof SettingsPatch, SettingKey> = {
  companyName: "general.company_name",
  timezone: "general.timezone",
  theme: "appearance.theme",
  colorMode: "appearance.color_mode",
  brandColor: "appearance.brand_color",
  defaultLanguage: "language.default",
  languages: "language.available",
  maxUploadMb: "files.max_upload_mb",
};

export const RECIPIENT_KINDS: RecipientKind[] = [
  "requester",
  "assignee",
  "stage_owner",
  "client_contacts",
  "account_manager",
  "team",
  "participants",
  "managers",
];

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DEFAULT_HOURS: [string, string][] = [["08:00", "17:00"]];
const CACHE_TTL_MS = 30_000;

export interface InstanceSettings {
  companyName: string;
  timezone: string;
  theme: (typeof THEMES)[number];
  colorMode: "light" | "dark" | "system";
  brandColor: string;
  defaultLanguage: Language;
  languages: Language[];
  maxUploadMb: number;
}

let cached: { value: InstanceSettings; expires: number } | null = null;

function pick<T>(raw: unknown, ok: (v: unknown) => v is T, fallback: T): T {
  return ok(raw) ? raw : fallback;
}
const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

async function load(): Promise<InstanceSettings> {
  if (cached && cached.expires > Date.now()) return cached.value;
  const rows = await settingsModel.byKeys(KEYS);
  const raw = (key: SettingKey) => rows.find((r) => r.key === key)?.value;
  const value: InstanceSettings = {
    companyName: pick(raw("general.company_name"), isString, DEFINITIONS["general.company_name"].fallback),
    timezone: pick(raw("general.timezone"), isString, DEFINITIONS["general.timezone"].fallback),
    theme: pick(raw("appearance.theme"), (v): v is InstanceSettings["theme"] => THEMES.includes(v as never), "blue"),
    colorMode: pick(raw("appearance.color_mode"), (v): v is InstanceSettings["colorMode"] => ["light", "dark", "system"].includes(v as string), "system"),
    brandColor: pick(raw("appearance.brand_color"), (v): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v), "#00387a"),
    defaultLanguage: pick(raw("language.default"), (v): v is Language => LANGUAGES.includes(v as never), DEFAULT_LANGUAGE),
    languages: pick(
      raw("language.available"),
      (v): v is Language[] => Array.isArray(v) && v.length > 0 && v.every((l) => LANGUAGES.includes(l as never)),
      [...LANGUAGES],
    ),
    maxUploadMb: pick(raw("files.max_upload_mb"), (v): v is number => typeof v === "number" && v > 0, 25),
  };
  value.maxUploadMb = Math.min(value.maxUploadMb, MAX_ATTACHMENT_BYTES / 1024 / 1024);
  cached = { value, expires: Date.now() + CACHE_TTL_MS };
  return value;
}

async function calendarDto() {
  const calendar = await settingsModel.defaultCalendar();
  if (!calendar) return null;
  const holidays = await settingsModel.holidays(calendar.id);
  const hours = calendar.working_hours ?? {};
  return {
    id: calendar.id,
    name: calendar.name,
    timezone: calendar.timezone,
    workingDays: WEEKDAYS.filter((d) => Array.isArray(hours[d]) && hours[d].length > 0),
    holidays: holidays.map((h) => ({ id: h.id, day: h.day.slice(0, 10), name: h.name })),
  };
}

async function rulesDto() {
  const rules = await settingsModel.rules();
  return rules
    .filter((r) => r.expand?.event_type?.code)
    .map((r) => ({
      id: r.id,
      event: r.expand!.event_type!.code,
      clientVisible: Boolean(r.expand!.event_type!.client_visible),
      recipients: r.recipients,
      active: r.active,
    }));
}

async function senderDto() {
  const sender = await settingsModel.defaultSender();
  return sender ? { id: sender.id, name: sender.name, fromEmail: sender.from_email, replyTo: sender.reply_to || null, provider: sender.provider } : null;
}

export const settingsService = {
  /** Valores con caché corta, para el resto de los services (correo, adjuntos…). */
  current: load,

  /** Lo mínimo para pintar la pantalla de login y los valores por defecto, sin sesión. */
  async publicSettings() {
    const s = await load();
    return {
      companyName: s.companyName,
      theme: s.theme,
      colorMode: s.colorMode,
      defaultLanguage: s.defaultLanguage,
      languages: s.languages,
      maxUploadMb: s.maxUploadMb,
    };
  },

  async get(actor: Actor) {
    assertCan(actor, "settings.manage");
    const [values, calendar, rules, sender] = await Promise.all([load(), calendarDto(), rulesDto(), senderDto()]);
    return { values, calendar, rules, sender, recipientKinds: RECIPIENT_KINDS };
  },

  async update(actor: Actor, patch: SettingsPatch) {
    assertCan(actor, "settings.manage");
    const next = { ...(await load()), ...patch };
    if (!next.languages.includes(next.defaultLanguage)) {
      throw Errors.validation([{ field: "defaultLanguage", code: "settings.default_language_disabled", message: "" }]);
    }
    const changes = (Object.keys(patch) as (keyof SettingsPatch)[]).map((field) => {
      const key = FIELD_KEYS[field];
      return { key, group: DEFINITIONS[key].group, value: patch[field] };
    });
    const current = await settingsModel.byKeys(changes.map((c) => c.key));
    await unitOfWork.commit(settingsModel.changeOps(current, changes, actor.userId));
    cached = null;
    return this.get(actor);
  },

  async updateSender(actor: Actor, input: SenderInput) {
    assertCan(actor, "settings.manage");
    const sender = await settingsModel.defaultSender();
    if (!sender) throw Errors.notFound();
    await settingsModel.updateSender(sender.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.fromEmail !== undefined && { from_email: input.fromEmail }),
      ...(input.replyTo !== undefined && { reply_to: input.replyTo ?? "" }),
    });
    return senderDto();
  },

  async updateRule(actor: Actor, id: string, input: UpdateRuleInput) {
    assertCan(actor, "settings.manage");
    if (!(await settingsModel.findRule(id))) throw Errors.notFound();
    await settingsModel.updateRule(id, input);
    return rulesDto();
  },

  async setWorkingDays(actor: Actor, input: WorkingDaysInput) {
    assertCan(actor, "settings.manage");
    const calendar = await settingsModel.defaultCalendar();
    if (!calendar) throw Errors.configuration("No hay calendario laboral por defecto.");
    const hours = calendar.working_hours ?? {};
    const working_hours = Object.fromEntries(
      WEEKDAYS.map((d) => [d, input.workingDays.includes(d) ? (hours[d]?.length ? hours[d] : DEFAULT_HOURS) : []]),
    );
    await settingsModel.updateCalendar(calendar.id, { working_hours });
    return calendarDto();
  },

  async addHoliday(actor: Actor, input: HolidayInput) {
    assertCan(actor, "settings.manage");
    const calendar = await settingsModel.defaultCalendar();
    if (!calendar) throw Errors.configuration("No hay calendario laboral por defecto.");
    if (await settingsModel.holidayOn(calendar.id, input.day)) throw Errors.conflict("settings.holiday_exists");
    await settingsModel.createHoliday({ calendar: calendar.id, day: dayToPb(input.day), name: input.name });
    return calendarDto();
  },

  async removeHoliday(actor: Actor, id: string) {
    assertCan(actor, "settings.manage");
    if (!(await settingsModel.findHoliday(id))) throw Errors.notFound();
    await settingsModel.deleteHoliday(id);
    return calendarDto();
  },

  /** Usado por el correo: no repite la consulta en cada vuelta del worker. */
  async brand(): Promise<{ companyName: string; brandColor: string }> {
    const s = await load();
    return { companyName: s.companyName, brandColor: s.brandColor };
  },
};
