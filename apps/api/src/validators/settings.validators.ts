import { z } from "zod";
import { LANGUAGES, THEMES } from "../config/constants.js";

const RECIPIENTS = ["requester", "assignee", "stage_owner", "client_contacts", "account_manager", "team", "participants", "managers"] as const;
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const settingsPatchSchema = z
  .object({
    companyName: z.string().trim().min(1).max(120),
    timezone: z.string().trim().max(64).refine(validTimezone, { message: "invalid_timezone" }),
    theme: z.enum(THEMES),
    colorMode: z.enum(["light", "dark", "system"]),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    defaultLanguage: z.enum(LANGUAGES),
    languages: z.array(z.enum(LANGUAGES)).min(1).max(LANGUAGES.length).transform((l) => [...new Set(l)]),
    maxUploadMb: z.number().int().min(1).max(25),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const senderSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    fromEmail: z.string().trim().email().max(200),
    replyTo: z.string().trim().email().max(200).nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type SenderInput = z.infer<typeof senderSchema>;

export const updateRuleSchema = z
  .object({
    recipients: z.array(z.enum(RECIPIENTS)).max(RECIPIENTS.length).transform((r) => [...new Set(r)]),
    active: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

export const workingDaysSchema = z.object({ workingDays: z.array(z.enum(WEEKDAYS)).min(1).max(7) }).strict();
export type WorkingDaysInput = z.infer<typeof workingDaysSchema>;

export const holidaySchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string().trim().min(1).max(120),
  })
  .strict();
export type HolidayInput = z.infer<typeof holidaySchema>;
