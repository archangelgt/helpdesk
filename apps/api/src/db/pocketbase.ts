import { randomBytes } from "node:crypto";
import PocketBase from "pocketbase";
import { env } from "../config/env.js";

/** Cliente de PocketBase autenticado como superusuario: solo lo usan los models. */
export const pb = new PocketBase(env.POCKETBASE_URL);
pb.autoCancellation(false);

let connecting: Promise<void> | null = null;

export async function ensureAdminAuth(): Promise<void> {
  if (pb.authStore.isValid) return;
  connecting ??= pb
    .collection("_superusers")
    .authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD, { autoRefreshThreshold: 30 * 60 })
    .then(() => undefined)
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Id de registro con el formato de PocketBase (15 caracteres [a-z0-9]).
 * Permite relacionar registros creados dentro del mismo batch.
 */
export function newRecordId(): string {
  const bytes = randomBytes(15);
  let id = "";
  for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length];
  return id;
}

/** Batch transaccional: o se aplican todas las operaciones o ninguna. */
export async function newBatch() {
  await ensureAdminAuth();
  return pb.createBatch();
}

/** Filtro `campo = a || campo = b …` con parámetros escapados. Con lista vacía no coincide con nada. */
export function anyOf(field: string, values: string[]): string {
  if (!values.length) return 'id = "" && id != ""';
  return `(${values.map((v) => pb.filter(`${field} = {:v}`, { v })).join(" || ")})`;
}

/** Formato de fecha que entienden los filtros y campos date de PocketBase. */
export function pbDate(date: Date): string {
  return date.toISOString().replace("T", " ");
}

/** Cliente sin sesión para verificar contraseñas de usuarios sin tocar la sesión de superusuario. */
export function anonymousClient(): PocketBase {
  const client = new PocketBase(env.POCKETBASE_URL);
  client.autoCancellation(false);
  return client;
}

export async function pocketbaseHealthy(): Promise<boolean> {
  try {
    await pb.health.check();
    return true;
  } catch {
    return false;
  }
}
