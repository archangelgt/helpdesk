export const LANGUAGES = ["es", "en", "pt"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "es";

export const COLOR_MODES = ["light", "dark", "system"] as const;
export const THEMES = ["blue", "orange", "green", "purple", "pink", "slate"] as const;

export const REFRESH_COOKIE = "hd_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export const PERMISSION_CACHE_TTL_MS = 60_000;
export const CATALOG_CACHE_TTL_MS = 60_000;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
