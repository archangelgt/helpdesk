import { clientsModel } from "../models/clients.model.js";
import { templatesModel } from "../models/templates.model.js";
import type { ClientRow } from "../types/records.js";
import { Errors } from "../utils/errors.js";
import type { CreateClientInput, UpdateClientInput } from "../validators/admin.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";

function clientDto(c: ClientRow, openItems = 0) {
  return {
    id: c.id,
    name: c.name,
    legalName: c.legal_name || null,
    taxId: c.tax_id || null,
    status: c.status,
    notes: c.notes || null,
    openItems,
  };
}

function clientData(input: UpdateClientInput) {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.legalName !== undefined && { legal_name: input.legalName }),
    ...(input.taxId !== undefined && { tax_id: input.taxId }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
  };
}

export const clientsService = {
  async list(actor: Actor, search?: string) {
    if (actor.isClient || !(actor.can("work_item.view_all") || actor.can("client.manage"))) throw Errors.forbidden();
    const [clients, counts] = await Promise.all([clientsModel.list(search), clientsModel.openWorkItemCounts()]);
    return clients.map((c) => clientDto(c, counts.get(c.id) ?? 0));
  },

  async create(actor: Actor, input: CreateClientInput) {
    assertCan(actor, "client.manage");
    return clientDto(await clientsModel.create(clientData(input)));
  },

  async update(actor: Actor, id: string, input: UpdateClientInput) {
    assertCan(actor, "client.manage");
    if (!(await clientsModel.findById(id))) throw Errors.notFound();
    return clientDto(await clientsModel.update(id, clientData(input)));
  },
};

export const templatesService = {
  async list(actor: Actor, typeCode?: string) {
    if (actor.isClient || !(actor.can("stage.manage") || actor.can("template.manage"))) throw Errors.forbidden();
    const catalog = await catalogCache.get();
    const type = typeCode ? catalog.typeByCode(typeCode) : undefined;
    if (typeCode && !type) return [];
    const templates = await templatesModel.list(type?.id);
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || null,
      typeId: t.type,
      stageCount: t.stageCount,
    }));
  },
};
