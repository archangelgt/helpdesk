import { newRecordId } from "../db/pocketbase.js";
import type { TemplateBundle } from "../models/templates.model.js";
import type { WriteOp } from "../models/unit-of-work.model.js";
import {
  addBusinessDays,
  dayToPb,
  followingBusinessDay,
  nextBusinessDay,
  type WorkCalendar,
} from "../utils/business-days.js";

export interface TemplatePlan {
  ops: WriteOp[];
  plannedStart: string;
  plannedEnd: string;
}

/**
 * Convierte una plantilla en etapas reales del caso. Cada etapa empieza el día hábil siguiente al
 * fin de la última etapa de la que depende (o en `startDay` si no depende de ninguna) y dura
 * `duration_days` días hábiles. Los requerimientos al cliente vencen `due_in_days` días hábiles
 * después del inicio de su etapa.
 */
export function planFromTemplate(
  bundle: TemplateBundle,
  args: { workItemId: string; startDay: string; calendar: WorkCalendar; initialStageStatus: string; actorId: string },
): TemplatePlan {
  const { workItemId, calendar, initialStageStatus, actorId } = args;
  const firstDay = nextBusinessDay(args.startDay, calendar);
  const stages = [...bundle.stages].sort((a, b) => a.sort_order - b.sort_order);
  const newIds = new Map(stages.map((s) => [s.id, newRecordId()]));
  const dependsOn = (stageId: string) => bundle.dependencies.filter((d) => d.stage === stageId).map((d) => d.depends_on);

  const ends = new Map<string, string>();
  const starts = new Map<string, string>();
  const pending = [...stages];
  // Orden topológico: una etapa se programa cuando todas sus dependencias ya tienen fecha.
  for (let guard = 0; pending.length && guard < stages.length * stages.length + 1; guard++) {
    const stage = pending.shift()!;
    const deps = dependsOn(stage.id);
    if (deps.some((d) => !ends.has(d))) {
      pending.push(stage);
      continue;
    }
    const latestEnd = deps.map((d) => ends.get(d)!).sort().pop();
    const start = latestEnd ? followingBusinessDay(latestEnd, calendar) : firstDay;
    starts.set(stage.id, start);
    ends.set(stage.id, addBusinessDays(start, Math.max((stage.duration_days || 1) - 1, 0), calendar));
  }

  const ops: WriteOp[] = [];
  stages.forEach((stage, index) => {
    const id = newIds.get(stage.id)!;
    const start = starts.get(stage.id) ?? firstDay;
    ops.push({
      op: "create",
      collection: "stages",
      data: {
        id,
        work_item: workItemId,
        template_stage: stage.id,
        name: stage.name,
        description: stage.description,
        sort_order: index + 1,
        status: initialStageStatus,
        responsible_side: stage.responsible_side,
        planned_start: dayToPb(start),
        planned_end: dayToPb(ends.get(stage.id) ?? start),
        weight: stage.weight > 0 ? stage.weight : 1,
        client_visible: stage.client_visible,
        requires_evidence: stage.requires_evidence,
        requires_client_approval: stage.requires_client_approval,
      },
    });
  });

  for (const dep of bundle.dependencies) {
    const stage = newIds.get(dep.stage);
    const dependsOnId = newIds.get(dep.depends_on);
    if (!stage || !dependsOnId) continue;
    ops.push({
      op: "create",
      collection: "stage_dependencies",
      data: { stage, depends_on: dependsOnId, dependency_type: "finish_to_start" },
    });
  }

  for (const item of bundle.checklist) {
    const stage = newIds.get(item.stage);
    if (stage) ops.push({ op: "create", collection: "checklist_items", data: { stage, title: item.title, sort_order: item.sort_order, is_done: false } });
  }

  for (const request of bundle.requests) {
    const stage = newIds.get(request.stage);
    if (!stage) continue;
    const start = starts.get(request.stage) ?? firstDay;
    ops.push({
      op: "create",
      collection: "client_requests",
      data: {
        work_item: workItemId,
        stage,
        template_request: request.id,
        title: request.title,
        description: request.description,
        request_type: request.request_type,
        requested_by: actorId,
        due_at: dayToPb(addBusinessDays(start, request.due_in_days || 0, calendar)),
        blocking: request.blocking,
        status: "pending",
        reminders_sent: 0,
      },
    });
  }

  const plannedEnd = [...ends.values()].sort().pop() ?? firstDay;
  return { ops, plannedStart: firstDay, plannedEnd };
}
