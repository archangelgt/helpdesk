import type { ZodType, ZodTypeDef } from "zod";
import { Errors } from "../utils/errors.js";

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw Errors.validation(result.error.issues.map((i) => ({ field: i.path.join("."), code: i.code, message: i.message })));
  }
  return result.data;
}
