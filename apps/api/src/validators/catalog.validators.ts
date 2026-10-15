import { z } from "zod";

export const boardQuerySchema = z.object({ type: z.string().regex(/^[a-z0-9_]+$/).max(60) });

export const statusesQuerySchema = z.object({
  workflow: z
    .string()
    .regex(/^[a-z0-9_.-]+$/)
    .max(80)
    .optional(),
});
