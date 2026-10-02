import { z } from "zod";

const boolString = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Proxies delante de la API (Apache → nginx = 2). Determina qué IP de X-Forwarded-For es la del cliente. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(2),

  POCKETBASE_URL: z.string().url(),
  PB_ADMIN_EMAIL: z.string().email(),
  PB_ADMIN_PASSWORD: z.string().min(10),

  /** Clave privada Ed25519 en PEM (PKCS8), codificada en base64. */
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default("helpdesk-v2"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  PUBLIC_URL: z.string().url(),
  COOKIE_SECURE: boolString.default("true"),
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Variables de entorno inválidas: ${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
