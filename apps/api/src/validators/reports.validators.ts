import { z } from "zod";
import { recordId } from "./work-items.validators.js";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportQuerySchema = z.object({
  /** Últimos N días (si no se envían from/to). */
  days: z.coerce.number().int().min(1).max(731).optional(),
  from: day.optional(),
  to: day.optional(),
  clientId: recordId.optional(),
  typeId: recordId.optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
