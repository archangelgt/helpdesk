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
