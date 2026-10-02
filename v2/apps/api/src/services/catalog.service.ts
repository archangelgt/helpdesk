import { rolesModel } from "../models/roles.model.js";
import { catalogCache } from "./catalog-cache.service.js";
import { toPriorityDto, toStatusDto, toTypeDto } from "./mappers.js";

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
