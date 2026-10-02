import { z } from "zod";
import { COLOR_MODES, LANGUAGES, THEMES } from "../config/constants.js";

export const preferencesSchema = z
  .object({
    language: z.enum(LANGUAGES).optional(),
    colorMode: z.enum(COLOR_MODES).optional(),
    theme: z.enum(THEMES).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Al menos una preferencia" });

export type PreferencesInput = z.infer<typeof preferencesSchema>;
