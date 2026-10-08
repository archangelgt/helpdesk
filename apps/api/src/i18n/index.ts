import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from "../config/constants.js";
import es from "./locales/es.js";
import en from "./locales/en.js";
import pt from "./locales/pt.js";

export type MessageKey = keyof typeof es;

const MESSAGES: Record<Language, Record<MessageKey, string>> = { es, en, pt };

/** Mensaje traducido; `{nombre}` se reemplaza con `params.nombre`. */
export function t(lang: Language, key: string, params?: Record<string, unknown>): string {
  const messages = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE];
  const text = (messages as Record<string, string>)[key] ?? (MESSAGES.es as Record<string, string>)[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** Elige el primer idioma soportado de un encabezado Accept-Language. */
export function pickLanguage(header: string | undefined): Language {
  if (!header) return DEFAULT_LANGUAGE;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const match = candidates.find((c) => isLanguage(c.lang));
  return match ? (match.lang as Language) : DEFAULT_LANGUAGE;
}
