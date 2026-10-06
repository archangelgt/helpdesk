import { z } from "zod";
import { recordId } from "./work-items.validators.js";

const text = (max: number) => z.string().trim().max(max);

export const listClientsSchema = z.object({ q: text(120).optional() });

export const createClientSchema = z
  .object({
    name: text(160).min(1),
    legalName: text(200).optional(),
    taxId: text(40).optional(),
    status: z.enum(["active", "inactive", "prospect"]).default("active"),
    notes: text(5_000).optional(),
  })
  .strict();
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientContactsQuerySchema = z.object({ clientId: recordId });

export const templatesQuerySchema = z.object({ type: z.string().regex(/^[a-z0-9_]+$/).max(60).optional() });

export const categoriesQuerySchema = z.object({ type: z.string().regex(/^[a-z0-9_]+$/).max(60).optional() });

export const testEmailSchema = z.object({ to: z.string().trim().email().max(200) }).strict();
