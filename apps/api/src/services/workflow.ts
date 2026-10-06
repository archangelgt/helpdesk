import type { StatusCategory, StatusRow, TransitionRow } from "../types/records.js";
import type { Actor } from "./actor.service.js";
import type { Catalog } from "./catalog-cache.service.js";
import { toStatusDto } from "./mappers.js";
import type { TransitionDto } from "../types/dto.js";

export type TransitionTarget = "work_item" | "stage";

/**
 * Si el actor puede usar una transición.
 * - `allowed_roles` vacío = cualquier rol del personal con el permiso del módulo.
 * - Los usuarios de clientes solo usan transiciones que los nombran explícitamente
 *   (ej. cerrar o reabrir un ticket resuelto, aprobar una etapa en revisión).
 */
export function canUseTransition(actor: Actor, transition: TransitionRow, to: StatusRow, target: TransitionTarget): boolean {
  const listed = transition.allowed_roles.includes(actor.roleId);
  if (actor.isClient) return listed && (target === "work_item" || actor.can("stage.approve"));
  if (transition.allowed_roles.length && !listed) return false;
  if (target === "work_item") return actor.can("work_item.transition");
  return actor.can(to.category === "closed" ? "stage.complete" : "stage.manage");
}

export function availableTransitions(
  catalog: Catalog,
  actor: Actor,
  fromStatusId: string,
  target: TransitionTarget,
): TransitionDto[] {
  return catalog
    .transitionsFrom(fromStatusId)
    .map((tr) => ({ tr, to: catalog.statusById.get(tr.to_status) }))
    .filter((x): x is { tr: TransitionRow; to: StatusRow } => !!x.to && x.to.active && canUseTransition(actor, x.tr, x.to, target))
    .sort((a, b) => a.to.sort_order - b.to.sort_order)
    .map(({ tr, to }) => ({ to: toStatusDto(to), requiresComment: tr.requires_comment }));
}

/** Primer estado (por orden) de un flujo con cierta categoría: así no dependemos de códigos fijos. */
export function statusByCategory(catalog: Catalog, workflowId: string, category: StatusCategory): StatusRow | undefined {
  return catalog.statuses
    .filter((s) => s.workflow === workflowId && s.category === category && s.active)
    .sort((a, b) => a.sort_order - b.sort_order)[0];
}

export function categoryOf(catalog: Catalog, statusId: string): StatusCategory | undefined {
  return catalog.statusById.get(statusId)?.category;
}
