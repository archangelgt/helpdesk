import { pb } from "../db/pocketbase.js";
import type { Actor } from "../services/actor.service.js";

/**
 * Filtro de PocketBase con los casos que el actor puede ver.
 * `prefix` permite aplicarlo a través de una relación (ej. "work_item." desde client_requests).
 *
 * - Usuarios de un cliente: solo casos de su empresa y de tipos visibles para clientes.
 * - Personal con `work_item.view_all`: todos.
 * - Resto del personal: los que tiene asignados, creó, solicitó o donde es responsable de una etapa.
 */
export function workItemVisibility(actor: Actor, prefix = ""): string {
  const p = prefix;
  const notDeleted = `${p}deleted_at = ""`;
  if (actor.isClient) {
    if (!actor.clientId) return 'id = "" && id != ""';
    return `${notDeleted} && ${pb.filter(`${p}client = {:c} && ${p}type.client_visible = true`, { c: actor.clientId })}`;
  }
  if (actor.can("work_item.view_all")) return notDeleted;
  return `${notDeleted} && ${pb.filter(
    `(${p}assignee = {:u} || ${p}created_by = {:u} || ${p}requester = {:u} || ${p}stages_via_work_item.owner ?= {:u})`,
    { u: actor.userId },
  )}`;
}
