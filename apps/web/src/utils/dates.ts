const DAY_MS = 86_400_000;

/** Día de calendario (YYYY-MM-DD) de una fecha de la API. Las fechas sin hora se guardan a mediodía UTC. */
export function toDay(value: string): string {
  return value.slice(0, 10);
}

function localDate(value: string): Date {
  return new Date(`${toDay(value)}T00:00:00`);
}

/** Días hasta la fecha (negativo = atrasado). */
export function daysUntil(value: string, today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((localDate(value).getTime() - start.getTime()) / DAY_MS);
}

export function formatDate(value: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(localDate(value));
}

export function formatDateTime(value: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value.replace(" ", "T")),
  );
}

export function todayDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
