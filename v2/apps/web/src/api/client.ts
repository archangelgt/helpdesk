import i18n from "../i18n";
import type { SessionResponse } from "../types/auth";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<SessionResponse | null> | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

async function send(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept-Language", i18n.language);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  if (auth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(BASE + path, { ...init, headers, credentials: "same-origin" });
}

async function toError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  return new ApiError(res.status, body?.error?.code ?? "common.internal_error", body?.error?.message ?? res.statusText);
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/**
 * Un solo refresh a la vez: el refresh token rota en cada uso, así que dos
 * llamadas simultáneas con la misma cookie harían fallar a la segunda.
 */
export function refreshSession(): Promise<SessionResponse | null> {
  refreshing ??= send("/auth/refresh", { method: "POST" }, false)
    .then(async (res) => {
      if (!res.ok) return null;
      const session = (await res.json()) as SessionResponse;
      accessToken = session.accessToken;
      return session;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function authorized(path: string, init: RequestInit): Promise<Response> {
  let res = await send(path, init);
  if (res.status === 401 && accessToken) {
    const session = await refreshSession();
    if (!session) {
      accessToken = null;
      onSessionLost?.();
      throw await toError(res);
    }
    res = await send(path, init);
  }
  return res;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return parse<T>(await authorized(path, init));
}

/** Descarga con el token de la sesión (un enlace normal no lleva el encabezado Authorization). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await authorized(path, {});
  if (!res.ok) throw await toError(res);
  return res.blob();
}

export const authApi = {
  async login(email: string, password: string): Promise<SessionResponse> {
    const session = await parse<SessionResponse>(
      await send("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
    );
    accessToken = session.accessToken;
    return session;
  },

  async logout(): Promise<void> {
    await send("/auth/logout", { method: "POST" }, false).catch(() => undefined);
    accessToken = null;
  },
};
