import { templatesModel } from "../models/templates.model.js";
import type { WorkItemTypeRow } from "../types/records.js";
import { buildCalendar, toDay, type WorkCalendar } from "../utils/business-days.js";
import { Errors } from "../utils/errors.js";
import type { PlanPreviewInput, PlanStageInput } from "../validators/work-items.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";
import { schedulePlan, stagesFromBundle, type PlanStage } from "./template-planner.js";
import { usersService } from "./users.service.js";

export async function workCalendar(): Promise<WorkCalendar> {
  const { calendar, holidays } = await templatesModel.defaultCalendar();
  return buildCalendar(calendar?.working_hours ?? null, holidays);
}

/**
 * Etapas con las que se crea una implementación: el plan que armó el asistente (a partir de una
 * plantilla o a mano) o, si no llega plan, la plantilla tal cual. null = sin etapas.
 */
export async function resolvePlan(type: WorkItemTypeRow, input: { templateId?: string | null; plan?: { stages: PlanStageInput[] } }): Promise<PlanStage[] | null> {
  if (!input.templateId && !input.plan) return null;
  const bundle = input.templateId ? await templatesModel.bundle(input.templateId) : null;
  if (input.templateId && (!bundle?.template.active || bundle.template.type !== type.id)) {
    throw Errors.validation([{ field: "templateId", code: "invalid", message: "" }]);
  }
  if (!input.plan) return stagesFromBundle(bundle!);

  const templateStages = new Set(bundle?.stages.map((s) => s.id) ?? []);
  const templateRequests = new Set(bundle?.requests.map((r) => r.id) ?? []);
  const owners = [...new Set(input.plan.stages.map((s) => s.ownerId).filter((id): id is string => Boolean(id)))];
  for (const owner of owners) await usersService.assertStaff(owner, "ownerId");

  return input.plan.stages.map((s) => ({
    key: s.key,
    templateStageId: s.templateStageId && templateStages.has(s.templateStageId) ? s.templateStageId : "",
    name: s.name,
    description: s.description,
    side: s.side,
    durationDays: s.durationDays,
    dependsOn: s.dependsOn,
    weight: s.weight,
    clientVisible: s.clientVisible,
    requiresEvidence: s.requiresEvidence,
    requiresClientApproval: s.requiresClientApproval,
    ownerId: s.ownerId ?? "",
    checklist: s.checklist,
    requests: s.requests.map((r) => ({
      templateRequestId: r.templateRequestId && templateRequests.has(r.templateRequestId) ? r.templateRequestId : "",
      title: r.title,
      description: r.description,
      type: r.type,
      dueInDays: r.dueInDays,
      blocking: r.blocking,
    })),
  }));
}

export const plansService = {
  /** Asistente: carga una plantilla como plan editable y calcula las fechas en días hábiles. */
  async preview(actor: Actor, input: PlanPreviewInput) {
    assertCan(actor, "work_item.create");
    if (actor.isClient || !actor.can("stage.manage")) throw Errors.forbidden();
    const catalog = await catalogCache.get();
    const type = catalog.types.find((t) => t.has_stages && t.active);
    if (!type) throw Errors.notFound();
    const stages = (await resolvePlan(type, input)) ?? [];
    const schedule = schedulePlan(stages, input.startDay ?? toDay(new Date()), await workCalendar());
    return {
      templateId: input.templateId ?? null,
      plannedStart: schedule.plannedStart,
      plannedEnd: schedule.plannedEnd,
      stages: schedule.stages.map((s) => ({
        ...s,
        templateStageId: s.templateStageId || null,
        ownerId: s.ownerId || null,
        requests: s.requests.map((r) => ({ ...r, templateRequestId: r.templateRequestId || null })),
      })),
    };
  },
};
