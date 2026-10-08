import { z } from "zod";
import { LANGUAGES } from "../config/constants.js";
import { recordId } from "./work-items.validators.js";

const text = (max: number) => z.string().trim().max(max);

export const listUsersSchema = z.object({
  q: text(120).optional(),
  roleId: recordId.optional(),
  clientId: recordId.optional(),
  scope: z.enum(["staff", "client"]).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>;

const userFields = {
  name: text(120).min(1),
  phone: text(40).optional(),
  roleId: recordId,
  /** Empresa cliente: obligatoria para roles de cliente; vacía para el personal. */
  clientId: recordId.nullable().optional(),
  language: z.enum(LANGUAGES).nullable().optional(),
  receivesNotifications: z.boolean().optional(),
};

export const createUserSchema = z
  .object({
    ...userFields,
    email: z.string().trim().toLowerCase().email().max(200),
    /** Vacío = se genera una contraseña temporal y se devuelve una sola vez. */
    password: z.string().min(10).max(72).optional(),
    sendWelcome: z.boolean().default(false),
  })
  .strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    ...userFields,
    email: z.string().trim().toLowerCase().email().max(200),
    status: z.enum(["active", "suspended"]),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10).max(72).optional(),
    sendEmail: z.boolean().default(false),
  })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
