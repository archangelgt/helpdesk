import { newRecordId } from "../db/pocketbase.js";
import type { TemplateBundle } from "../models/templates.model.js";
import type { WriteOp } from "../models/unit-of-work.model.js";
import type { ClientRequestType, ResponsibleSide } from "../types/records.js";
import {
  addBusinessDays,
  dayToPb,
  followingBusinessDay,
  nextBusinessDay,
  type WorkCalendar,
} from "../utils/business-days.js";
import { AppError } from "../utils/errors.js";

/** Una etapa del plan, venga de una plantilla (editada o no) o armada a mano en el asistente. */
export interface PlanStage {
  key: string;
  templateStageId: string;
  name: string;
  description: string;
  side: ResponsibleSide;
  durationDays: number;
  dependsOn: string[];
  weight: number;
  clientVisible: boolean;
  requiresEvidence: boolean;
  requiresClientApproval: boolean;
  ownerId: string;
  checklist: string[];
  requests: PlanRequest[];
}

export interface PlanRequest {
  templateRequestId: string;
  title: string;
  description: string;
  type: ClientRequestType;
  dueInDays: number;
  blocking: boolean;
}

export interface TemplatePlan {
  ops: WriteOp[];
  plannedStart: string;
  plannedEnd: string;
}

export interface ScheduledStage extends PlanStage {
  plannedStart: string;
  plannedEnd: string;
  requests: (PlanRequest & { dueDay: string })[];
}

export function stagesFromBundle(bundle: TemplateBundle): PlanStage[] {
  return [...bundle.stages]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      key: s.id,
      templateStageId: s.id,
      name: s.name,
      description: s.description ?? "",
      side: s.responsible_side,
      durationDays: s.duration_days || 1,
      dependsOn: bundle.dependencies.filter((d) => d.stage === s.id).map((d) => d.depends_on),
      weight: s.weight > 0 ? s.weight : 1,
      clientVisible: s.client_visible,
      requiresEvidence: s.requires_evidence,
      requiresClientApproval: s.requires_client_approval,
      ownerId: "",
      checklist: bundle.checklist.filter((c) => c.stage === s.id).sort((a, b) => a.sort_order - b.sort_order).map((c) => c.title),
      requests: bundle.requests
        .filter((r) => r.stage === s.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => ({
          templateRequestId: r.id,
          title: r.title,
          description: r.description ?? "",
          type: r.request_type,
          dueInDays: r.due_in_days || 0,
          blocking: r.blocking,
        })),
    }));
}

/**
 * Fechas del plan. Cada etapa empieza el día hábil siguiente al fin de la última etapa de la que
 * depende (o en `startDay` si no depende de ninguna) y dura `durationDays` días hábiles. Los
 * requerimientos al cliente vencen `dueInDays` días hábiles después del inicio de su etapa.
 */
export function schedulePlan(stages: PlanStage[], startDay: string, calendar: WorkCalendar): { stages: ScheduledStage[]; plannedStart: string; plannedEnd: string } {
  const keys = new Set(stages.map((s) => s.key));
  if (keys.size !== stages.length) throw new AppError(400, "plan.duplicate_key");
  for (const s of stages) {
    if (s.dependsOn.some((d) => !keys.has(d) || d === s.key)) throw new AppError(400, "plan.invalid_dependency");
  }
  const firstDay = nextBusinessDay(startDay, calendar);
  const ends = new Map<string, string>();
  const starts = new Map<string, string>();
  const pending = [...stages];
  // Orden topológico: una etapa se programa cuando todas sus dependencias ya tienen fecha.
  for (let guard = 0; pending.length && guard < stages.length * stages.length + 1; guard++) {
    const stage = pending.shift()!;
    if (stage.dependsOn.some((d) => !ends.has(d))) {
      pending.push(stage);
      continue;
    }
    const latestEnd = stage.dependsOn.map((d) => ends.get(d)!).sort().pop();
    const start = latestEnd ? followingBusinessDay(latestEnd, calendar) : firstDay;
    starts.set(stage.key, start);
    ends.set(stage.key, addBusinessDays(start, Math.max((stage.durationDays || 1) - 1, 0), calendar));
  }
  if (pending.length) throw new AppError(400, "plan.dependency_cycle");

  const scheduled = stages.map((s) => {
    const start = starts.get(s.key)!;
    return {
      ...s,
      plannedStart: start,
      plannedEnd: ends.get(s.key)!,
      requests: s.requests.map((r) => ({ ...r, dueDay: addBusinessDays(start, r.dueInDays || 0, calendar) })),
    };
  });
  return { stages: scheduled, plannedStart: firstDay, plannedEnd: [...ends.values()].sort().pop() ?? firstDay };
}

/** Convierte el plan en etapas, dependencias, checklists y requerimientos reales del caso. */
export function planStages(
  stages: PlanStage[],
  args: { workItemId: string; startDay: string; calendar: WorkCalendar; initialStageStatus: string; actorId: string },
): TemplatePlan {
  const { workItemId, initialStageStatus, actorId } = args;
  const schedule = schedulePlan(stages, args.startDay, args.calendar);
  const newIds = new Map(stages.map((s) => [s.key, newRecordId()]));

  const ops: WriteOp[] = [];
  schedule.stages.forEach((stage, index) => {
    ops.push({
      op: "create",
      collection: "stages",
      data: {
        id: newIds.get(stage.key)!,
        work_item: workItemId,
        template_stage: stage.templateStageId,
        name: stage.name,
        description: stage.description,
        sort_order: index + 1,
        status: initialStageStatus,
        responsible_side: stage.side,
        owner: stage.ownerId,
        planned_start: dayToPb(stage.plannedStart),
        planned_end: dayToPb(stage.plannedEnd),
        weight: stage.weight > 0 ? stage.weight : 1,
        client_visible: stage.clientVisible,
        requires_evidence: stage.requiresEvidence,
        requires_client_approval: stage.requiresClientApproval,
      },
    });
  });

  for (const stage of schedule.stages) {
    const id = newIds.get(stage.key)!;
    for (const dep of stage.dependsOn) {
      ops.push({
        op: "create",
        collection: "stage_dependencies",
        data: { stage: id, depends_on: newIds.get(dep)!, dependency_type: "finish_to_start" },
      });
    }
    stage.checklist.forEach((title, i) => {
      ops.push({ op: "create", collection: "checklist_items", data: { stage: id, title, sort_order: i + 1, is_done: false } });
    });
    for (const request of stage.requests) {
      ops.push({
        op: "create",
        collection: "client_requests",
        data: {
          work_item: workItemId,
          stage: id,
          template_request: request.templateRequestId,
          title: request.title,
          description: request.description,
          request_type: request.type,
          requested_by: actorId,
          due_at: dayToPb(request.dueDay),
          blocking: request.blocking,
          status: "pending",
          reminders_sent: 0,
        },
      });
    }
  }
  return { ops, plannedStart: schedule.plannedStart, plannedEnd: schedule.plannedEnd };
}

export function planFromTemplate(
  bundle: TemplateBundle,
  args: { workItemId: string; startDay: string; calendar: WorkCalendar; initialStageStatus: string; actorId: string },
): TemplatePlan {
  return planStages(stagesFromBundle(bundle), args);
}
