import { newRecordId, pbDate } from "../db/pocketbase.js";
import { stagesModel } from "../models/stages.model.js";
import { unitOfWork, type WriteOp } from "../models/unit-of-work.model.js";
import type { ChecklistItemRow, StageRow } from "../types/records.js";
import type { WorkItemDetailDto } from "../types/dto.js";
import { dayToPb } from "../utils/business-days.js";
import { Errors } from "../utils/errors.js";
import type {
  ChecklistUpdateInput,
  CreateStageInput,
  TransitionInput,
  UpdateStageInput,
} from "../validators/work-items.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";
import { eventOps } from "./events.js";
import { ImplementationPlan, loadImplementationState } from "./implementation-engine.js";
import { usersService } from "./users.service.js";
import { loadVisibleWorkItem, workItemsService } from "./work-items.service.js";
import { canUseTransition } from "./workflow.js";

async function loadImplementation(actor: Actor, workItemId: string) {
  const item = await loadVisibleWorkItem(actor, workItemId);
  const catalog = await catalogCache.get();
  const type = catalog.typeById.get(item.type);
  if (!type?.has_stages) throw Errors.conflict("work_item.without_stages");
  const state = await loadImplementationState(item, type);
  return { item, type, catalog, state };
}

async function loadStage(actor: Actor, stageId: string) {
  const row = await stagesModel.findById(stageId);
  if (!row) throw Errors.notFound();
  if (actor.isClient && !row.client_visible) throw Errors.notFound();
  const ctx = await loadImplementation(actor, row.work_item);
  const stage = ctx.state.stages.find((s) => s.id === row.id);
  if (!stage) throw Errors.notFound();
  return { ...ctx, stage };
}

function checklistPermission(item: ChecklistItemRow): string {
  return item.stage ? "stage.manage" : "work_item.update";
}

export const stagesService = {
  async transition(actor: Actor, stageId: string, input: TransitionInput): Promise<WorkItemDetailDto> {
    const { catalog, type, state, stage, item } = await loadStage(actor, stageId);
    const from = catalog.statusById.get(stage.status);
    const to = catalog.statusById.get(input.statusId);
    if (!from || !to || to.workflow !== type.stage_workflow) throw Errors.validation([{ field: "statusId", code: "invalid", message: "" }]);
    const transition = catalog.transition(from.id, to.id);
    if (!transition) throw Errors.conflict("workflow.invalid_transition");
    if (!canUseTransition(actor, transition, to, "stage")) throw Errors.forbidden();
    if (transition.requires_comment && !input.comment) throw Errors.conflict("workflow.comment_required");

    const plan = new ImplementationPlan(catalog, state, actor.userId);
    if (from.category === "new" && to.category === "in_progress") {
      if (!plan.dependenciesDone(stage)) throw Errors.conflict("stage.dependencies_pending");
      plan.startStage(stage);
    } else if (to.category === "closed") {
      if (plan.openBlockingRequests(stage).length) throw Errors.conflict("stage.client_requests_pending");
      if (stage.requires_client_approval && from.category === "in_progress") throw Errors.conflict("stage.requires_client_approval");
      plan.completeStage(stage, to);
    } else {
      plan.setStageStatus(stage, to);
    }
    plan.syncItemStatus();

    const ops: WriteOp[] = [...plan.ops];
    if (input.comment) {
      ops.push({
        op: "create",
        collection: "comments",
        data: { work_item: item.id, stage: stage.id, author: actor.userId, body: input.comment, visibility: actor.isClient ? "public" : "internal" },
      });
    }
    await unitOfWork.commit([...ops, ...eventOps(catalog, plan.events)]);
    return workItemsService.get(actor, item.id);
  },

  async create(actor: Actor, workItemId: string, input: CreateStageInput): Promise<WorkItemDetailDto> {
    assertCan(actor, "stage.manage");
    if (actor.isClient) throw Errors.forbidden();
    const { catalog, type, state, item } = await loadImplementation(actor, workItemId);
    const ownerId = input.ownerId ? (await usersService.assertStaff(input.ownerId, "ownerId")).id : "";
    const ordered = [...state.stages].sort((a, b) => a.sort_order - b.sort_order);
    const previous: StageRow | undefined = ordered[ordered.length - 1];
    const id = newRecordId();

    const ops: WriteOp[] = [
      {
        op: "create",
        collection: "stages",
        data: {
          id,
          work_item: item.id,
          name: input.name,
          description: input.description ?? "",
          sort_order: previous ? previous.sort_order + 1 : 1,
          status: catalog.initialStatus(type.stage_workflow).id,
          responsible_side: input.side,
          owner: ownerId,
          planned_start: input.plannedStart ? dayToPb(input.plannedStart) : "",
          planned_end: input.plannedEnd ? dayToPb(input.plannedEnd) : "",
          weight: input.weight ?? 1,
          client_visible: true,
          requires_evidence: false,
          requires_client_approval: false,
        },
      },
    ];
    if (input.dependsOnPrevious && previous) {
      ops.push({ op: "create", collection: "stage_dependencies", data: { stage: id, depends_on: previous.id, dependency_type: "finish_to_start" } });
    }
    await unitOfWork.commit(ops);
    return workItemsService.get(actor, item.id);
  },

  async update(actor: Actor, stageId: string, input: UpdateStageInput): Promise<WorkItemDetailDto> {
    assertCan(actor, "stage.manage");
    if (actor.isClient) throw Errors.forbidden();
    const { stage, item } = await loadStage(actor, stageId);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.ownerId !== undefined) data.owner = input.ownerId ? (await usersService.assertStaff(input.ownerId, "ownerId")).id : "";
    if (input.plannedStart !== undefined) data.planned_start = input.plannedStart ? dayToPb(input.plannedStart) : "";
    if (input.plannedEnd !== undefined) data.planned_end = input.plannedEnd ? dayToPb(input.plannedEnd) : "";
    await unitOfWork.commit([{ op: "update", collection: "stages", id: stage.id, data }]);
    return workItemsService.get(actor, item.id);
  },

  async addChecklistItem(actor: Actor, target: { stageId?: string; workItemId?: string }, title: string): Promise<WorkItemDetailDto> {
    if (actor.isClient) throw Errors.forbidden();
    let workItemId: string;
    let owner: Record<string, string>;
    let siblings: ChecklistItemRow[];
    if (target.stageId) {
      assertCan(actor, "stage.manage");
      const { stage, item } = await loadStage(actor, target.stageId);
      workItemId = item.id;
      owner = { stage: stage.id };
      siblings = await stagesModel.checklistByStages([stage.id]);
    } else {
      assertCan(actor, "work_item.update");
      const item = await loadVisibleWorkItem(actor, target.workItemId!);
      workItemId = item.id;
      owner = { work_item: item.id };
      siblings = await stagesModel.checklistByWorkItem(item.id);
    }
    const order = siblings.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;
    await unitOfWork.commit([{ op: "create", collection: "checklist_items", data: { ...owner, title, sort_order: order, is_done: false } }]);
    return workItemsService.get(actor, workItemId);
  },

  async updateChecklistItem(actor: Actor, id: string, input: ChecklistUpdateInput): Promise<WorkItemDetailDto> {
    if (actor.isClient) throw Errors.forbidden();
    const checklistItem = await stagesModel.findChecklistItem(id);
    if (!checklistItem) throw Errors.notFound();
    assertCan(actor, checklistPermission(checklistItem));
    const workItemId = checklistItem.stage
      ? (await loadStage(actor, checklistItem.stage)).item.id
      : (await loadVisibleWorkItem(actor, checklistItem.work_item)).id;

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.isDone !== undefined && input.isDone !== checklistItem.is_done) {
      data.is_done = input.isDone;
      data.done_by = input.isDone ? actor.userId : "";
      data.done_at = input.isDone ? pbDate(new Date()) : "";
    }
    if (Object.keys(data).length) await unitOfWork.commit([{ op: "update", collection: "checklist_items", id, data }]);
    return workItemsService.get(actor, workItemId);
  },
};
