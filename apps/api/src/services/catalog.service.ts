import { rolesModel } from "../models/roles.model.js";
import { Errors } from "../utils/errors.js";
import type { Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";
import { toPriorityDto, toStatusDto, toTypeDto } from "./mappers.js";
import { availableTransitions } from "./workflow.js";

export const catalogService = {
  async roles() {
    return rolesModel.list();
  },

  async workItemTypes() {
    const catalog = await catalogCache.get();
    return catalog.types.filter((t) => t.active).map(toTypeDto);
  },

  async statuses(workflowCode?: string) {
    const catalog = await catalogCache.get();
    const workflowById = new Map(catalog.workflows.map((w) => [w.id, w.code]));
    return catalog.statuses
      .filter((s) => s.active && (!workflowCode || workflowById.get(s.workflow) === workflowCode))
      .map((s) => ({ ...toStatusDto(s), workflow: workflowById.get(s.workflow) ?? null }));
  },

  /** Columnas del tablero por estado: los estados del flujo del tipo y a cuáles puede pasar el usuario desde cada uno. */
  async board(actor: Actor, typeCode: string) {
    const catalog = await catalogCache.get();
    const type = catalog.typeByCode(typeCode);
    if (!type || !type.active) throw Errors.notFound();
    const statuses = catalog.statuses.filter((s) => s.active && s.workflow === type.workflow).sort((a, b) => a.sort_order - b.sort_order);
    return {
      statuses: statuses.map((s) => ({
        ...toStatusDto(s),
        next: availableTransitions(catalog, actor, s.id, "work_item").map((t) => ({ statusId: t.to.id, requiresComment: t.requiresComment })),
      })),
    };
  },

  async priorities() {
    const catalog = await catalogCache.get();
    return catalog.priorities.filter((p) => p.active).map(toPriorityDto);
  },

  async categories(typeCode?: string) {
    const catalog = await catalogCache.get();
    const type = typeCode ? catalog.typeByCode(typeCode) : undefined;
    if (typeCode && !type) return [];
    return catalog.categories
      .filter((c) => c.active && (!type || c.type === type.id))
      .map((c) => ({ id: c.id, name: c.name, typeId: c.type ?? null }));
  },

  async products() {
    const catalog = await catalogCache.get();
    return catalog.products.filter((p) => p.active).map((p) => ({ id: p.id, code: p.code ?? null, name: p.name }));
  },
};
