/**
 * Fechas de plan en días hábiles. Se trabaja con fechas de calendario (YYYY-MM-DD) para que la
 * zona horaria del servidor no corra los días; se guardan a mediodía UTC.
 */

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface WorkCalendar {
  /** Días con horario laboral (claves mon…sun con al menos un tramo). */
  workingDays: Set<string>;
  holidays: Set<string>;
}

export function buildCalendar(workingHours: Record<string, unknown[]> | null, holidays: string[]): WorkCalendar {
  const days = workingHours
    ? Object.entries(workingHours).filter(([, ranges]) => Array.isArray(ranges) && ranges.length).map(([d]) => d)
    : ["mon", "tue", "wed", "thu", "fri"];
  return { workingDays: new Set(days), holidays: new Set(holidays) };
}

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDay(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00:00.000Z`);
}

/** Valor para un campo date de PocketBase a partir de YYYY-MM-DD. */
export function dayToPb(day: string): string {
  return `${day.slice(0, 10)} 12:00:00.000Z`;
}

export function isBusinessDay(day: string, cal: WorkCalendar): boolean {
  const weekday = WEEKDAY_KEYS[parseDay(day).getUTCDay()];
  return cal.workingDays.has(weekday) && !cal.holidays.has(day);
}

function shift(day: string, delta: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + delta);
  return toDay(d);
}

/** El mismo día si es hábil; si no, el siguiente hábil. */
export function nextBusinessDay(day: string, cal: WorkCalendar): string {
  let current = day;
  for (let i = 0; i < 366 && !isBusinessDay(current, cal); i++) current = shift(current, 1);
  return current;
}

/** Suma `n` días hábiles a un día hábil (n = 0 devuelve el mismo día). */
export function addBusinessDays(day: string, n: number, cal: WorkCalendar): string {
  let current = nextBusinessDay(day, cal);
  for (let added = 0; added < n; ) {
    current = shift(current, 1);
    if (isBusinessDay(current, cal)) added++;
  }
  return current;
}

/** Día hábil siguiente a `day` (para encadenar etapas). */
export function followingBusinessDay(day: string, cal: WorkCalendar): string {
  return nextBusinessDay(shift(day, 1), cal);
}
