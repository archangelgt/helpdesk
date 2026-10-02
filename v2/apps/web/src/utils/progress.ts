import type { ChecklistStatus, ClientRequest, Implementation, Stage } from "../types/implementation";

const SCORE: Record<ChecklistStatus, number> = { done: 1, in_progress: 0.5, pending: 0 };
const DAY_MS = 86_400_000;

export function stagePercent(stage: Stage): number {
  if (stage.status === "completed") return 100;
  if (!stage.checklist.length) return stage.status === "pending" ? 0 : 50;
  const score = stage.checklist.reduce((sum, item) => sum + SCORE[item.status], 0);
  return Math.round((score / stage.checklist.length) * 100);
}

export function implementationPercent(impl: Implementation): number {
  if (!impl.stages.length) return 0;
  return Math.round(impl.stages.reduce((sum, s) => sum + stagePercent(s), 0) / impl.stages.length);
}

export function currentStage(impl: Implementation): Stage | undefined {
  return impl.stages.find((s) => s.status !== "completed") ?? impl.stages[impl.stages.length - 1];
}

export function openClientRequests(impl: Implementation): ClientRequest[] {
  return impl.requests.filter((r) => r.status === "pending" || r.status === "rejected");
}

export function requestsToReview(impl: Implementation): ClientRequest[] {
  return impl.requests.filter((r) => r.status === "submitted" || r.status === "in_review");
}

/** Días hasta la fecha (negativo = atrasado). */
export function daysUntil(date: string, today = new Date()): number {
  const target = new Date(`${date}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / DAY_MS);
}

export function formatDate(date: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}
