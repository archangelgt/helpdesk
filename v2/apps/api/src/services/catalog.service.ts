import { catalogModel } from "../models/catalog.model.js";
import { rolesModel } from "../models/roles.model.js";

export const catalogService = {
  async roles() {
    return rolesModel.list();
  },

  async workItemTypes() {
    const rows = await catalogModel.workItemTypes();
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      labelKey: r.label_key,
      icon: r.icon,
      color: r.color,
      numberPrefix: r.number_prefix,
      hasStages: r.has_stages,
      clientVisible: r.client_visible,
    }));
  },

  async statuses(workflowCode?: string) {
    const rows = await catalogModel.statuses(workflowCode);
    return rows.map((r) => ({
      id: r.id,
      workflow: r.expand?.workflow?.code ?? null,
      code: r.code,
      name: r.name,
      labelKey: r.label_key,
      category: r.category,
      clientLabel: r.client_label || null,
      color: r.color,
      order: r.sort_order,
      isInitial: r.is_initial,
      isFinal: r.is_final,
      pausesSla: r.pauses_sla,
    }));
  },

  async priorities() {
    const rows = await catalogModel.priorities();
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      labelKey: r.label_key,
      level: r.level,
      color: r.color,
      isDefault: r.is_default,
    }));
  },
};
