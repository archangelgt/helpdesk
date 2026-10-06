import type { ChecklistItemRow, StageRow, StatusCategory } from "../types/records.js";

/**
 * Avance que se muestra: una etapa cerrada vale 100 %, una omitida no cuenta y el resto avanza
 * según su checklist. (El campo progress_percent de la base solo cuenta etapas cerradas.)
 */
export function stageProgress(category: StatusCategory | undefined, checklist: ChecklistItemRow[]): number | null {
  if (category === "cancelled") return null;
  if (category === "closed" || category === "resolved") return 100;
  if (!checklist.length) return 0;
  return Math.round((checklist.filter((c) => c.is_done).length / checklist.length) * 100);
}

export function weightedProgress(stages: { stage: StageRow; progress: number | null }[]): number {
  let total = 0;
  let done = 0;
  for (const { stage, progress } of stages) {
    if (progress === null) continue;
    const weight = stage.weight > 0 ? stage.weight : 1;
    total += weight;
    done += weight * progress;
  }
  return total ? Math.round(done / total) : 0;
}

/** Etapa actual: la primera sin cerrar (por orden); si todas cerraron, la última. */
export function currentStage<T extends { sort_order: number }>(stages: T[], isFinal: (s: T) => boolean): T | null {
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  return ordered.find((s) => !isFinal(s)) ?? ordered[ordered.length - 1] ?? null;
}
