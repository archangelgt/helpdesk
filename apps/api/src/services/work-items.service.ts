import { newRecordId, pbDate } from "../db/pocketbase.js";
import { activityModel } from "../models/activity.model.js";
import { attachmentsModel } from "../models/attachments.model.js";
import { clientRequestsModel } from "../models/client-requests.model.js";
import { stagesModel } from "../models/stages.model.js";
import { templatesModel } from "../models/templates.model.js";
import { unitOfWork, type WriteOp } from "../models/unit-of-work.model.js";
import { workItemVisibility } from "../models/visibility.js";
import { workItemsModel, type WorkItemCriteria } from "../models/work-items.model.js";
import type {
  ActivityDto,
  ImplementationSummaryDto,
  StageDto,
  WorkItemDetailDto,
  WorkItemSummaryDto,
} from "../types/dto.js";
import {
  DONE_CATEGORIES,
  OPEN_CATEGORIES,
  OPEN_REQUEST_STATUSES,
  REVIEW_REQUEST_STATUSES,
  type ChecklistItemRow,
  type ClientRequestRow,
  type StageRow,
  type StatusCategory,
  type WorkItemRow,
  type WorkItemTypeRow,
} from "../types/records.js";
import { buildCalendar, dayToPb, toDay } from "../utils/business-days.js";
import { Errors } from "../utils/errors.js";
import type {
  CreateWorkItemInput,
  ListWorkItemsInput,
  TransitionInput,
  UpdateWorkItemInput,
} from "../validators/work-items.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { attachmentVisible } from "./attachment-rules.js";
import { catalogCache, type Catalog } from "./catalog-cache.service.js";
import { eventOps, type DomainEvent } from "./events.js";
import { ImplementationPlan, loadImplementationState } from "./implementation-engine.js";
import { orNull, ref, toAttachmentDto, toChecklistDto, toClientRequestDto, toPriorityDto, toStatusDto } from "./mappers.js";
import { currentStage, stageProgress, weightedProgress } from "./progress.js";
import { planFromTemplate } from "./template-planner.js";
import { usersService } from "./users.service.js";
import { availableTransitions, canUseTransition, categoryOf } from "./workflow.js";

const FINISHED_CATEGORIES: StatusCategory[] = [...DONE_CATEGORIES, "cancelled"];

const VIEW_CATEGORIES: Record<ListWorkItemsInput["view"], StatusCategory[] | undefined> = {
  open: OPEN_CATEGORIES,
  waiting_client: ["waiting_client"],
  done: FINISHED_CATEGORIES,
  all: undefined,
};

function typeOf(catalog: Catalog, row: WorkItemRow): WorkItemTypeRow {
  const type = catalog.typeById.get(row.type);
  if (!type) throw Errors.configuration(`unknown work item type ${row.type}`);
  return type;
}

export async function loadVisibleWorkItem(actor: Actor, id: string): Promise<WorkItemRow> {
  const row = await workItemsModel.findVisible(id, workItemVisibility(actor));
  if (!row) throw Errors.notFound();
  return row;
}

function summaryOf(row: WorkItemRow, catalog: Catalog, implementation?: { dto: ImplementationSummaryDto; progress: number }): WorkItemSummaryDto {
  const type = typeOf(catalog, row);
  const status = catalog.statusById.get(row.status);
  if (!status) throw Errors.configuration(`unknown status ${row.status}`);
  const priority = row.priority ? catalog.priorityById.get(row.priority) : undefined;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    type: { id: type.id, code: type.code, name: type.name, color: type.color, icon: type.icon, hasStages: type.has_stages },
    status: toStatusDto(status),
    priority: priority ? toPriorityDto(priority) : null,
    client: ref(row.expand?.client),
    assignee: ref(row.expand?.assignee),
    requester: ref(row.expand?.requester),
    dueAt: orNull(row.due_at),
    plannedStart: orNull(row.planned_start),
    plannedEnd: orNull(row.planned_end),
    progressPercent: implementation?.progress ?? row.progress_percent ?? 0,
    created: row.created,
    updated: row.updated,
    ...(implementation && { implementation: implementation.dto }),
  };
}

function implementationSummary(
  catalog: Catalog,
  stages: StageRow[],
  checklist: ChecklistItemRow[],
  requests: Pick<ClientRequestRow, "status">[],
): { dto: ImplementationSummaryDto; progress: number } {
  const isFinal = (s: StageRow) => ["closed", "resolved", "cancelled"].includes(categoryOf(catalog, s.status) ?? "");
  const progress = weightedProgress(
    stages.map((stage) => ({
      stage,
      progress: stageProgress(categoryOf(catalog, stage.status), checklist.filter((c) => c.stage === stage.id)),
    })),
  );
  const current = currentStage(stages, isFinal);
  return {
    progress,
    dto: {
      currentStage: current ? { id: current.id, order: current.sort_order, name: current.name } : null,
      stageCount: stages.length,
      completedStages: stages.filter(isFinal).length,
      openRequests: requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status)).length,
      requestsToReview: requests.filter((r) => REVIEW_REQUEST_STATUSES.includes(r.status)).length,
    },
  };
}

/** Una implementación se completa cerrando sus etapas, no a mano. */
function hasOpenStages(catalog: Catalog, stages: StageRow[]): boolean {
  return stages.some((s) => !FINISHED_CATEGORIES.includes(categoryOf(catalog, s.status) ?? "new"));
}

async function implementationSummaries(actor: Actor, catalog: Catalog, rows: WorkItemRow[]) {
  const ids = rows.filter((r) => catalog.typeById.get(r.type)?.has_stages).map((r) => r.id);
  const result = new Map<string, { dto: ImplementationSummaryDto; progress: number }>();
  if (!ids.length) return result;
  const allStages = (await stagesModel.listByWorkItems(ids)).filter((s) => !actor.isClient || s.client_visible);
  const [checklist, requests] = await Promise.all([
    stagesModel.checklistByStages(allStages.map((s) => s.id)),
    clientRequestsModel.listByWorkItems(ids, [...OPEN_REQUEST_STATUSES, ...REVIEW_REQUEST_STATUSES]),
  ]);
  for (const id of ids) {
    const stages = allStages.filter((s) => s.work_item === id);
    result.set(id, implementationSummary(catalog, stages, checklist, requests.filter((r) => r.work_item === id)));
  }
  return result;
}

async function detailOf(actor: Actor, row: WorkItemRow): Promise<WorkItemDetailDto> {
  const catalog = await catalogCache.get();
  const type = typeOf(catalog, row);
  const [allStages, dependencies, requests, itemChecklist, attachments] = await Promise.all([
    type.has_stages ? stagesModel.listByWorkItem(row.id) : Promise.resolve([] as StageRow[]),
    type.has_stages ? stagesModel.dependencies(row.id) : Promise.resolve([]),
    clientRequestsModel.listByWorkItem(row.id),
    stagesModel.checklistByWorkItem(row.id),
    attachmentsModel.listByWorkItem(row.id),
  ]);
  const stages = allStages.filter((s) => !actor.isClient || s.client_visible);
  const stageChecklist = await stagesModel.checklistByStages(stages.map((s) => s.id));

  const stageDtos: StageDto[] = stages.map((s) => {
    const status = catalog.statusById.get(s.status)!;
    const checklist = stageChecklist.filter((c) => c.stage === s.id);
    return {
      id: s.id,
      order: s.sort_order,
      name: s.name,
      description: s.description,
      status: toStatusDto(status),
      side: s.responsible_side,
      owner: ref(s.expand?.owner),
      plannedStart: orNull(s.planned_start),
      plannedEnd: orNull(s.planned_end),
      startedAt: orNull(s.started_at),
      completedAt: orNull(s.completed_at),
      weight: s.weight > 0 ? s.weight : 1,
      progress: stageProgress(status.category, checklist) ?? 0,
      clientVisible: s.client_visible,
      requiresEvidence: s.requires_evidence,
      requiresClientApproval: s.requires_client_approval,
      dependsOn: dependencies.filter((d) => d.stage === s.id).map((d) => d.depends_on),
      checklist: checklist.map(toChecklistDto),
      transitions: availableTransitions(catalog, actor, s.status, "stage"),
    };
  });

  const implementation = type.has_stages ? implementationSummary(catalog, stages, stageChecklist, requests) : undefined;
  const category = row.category ? catalog.categories.find((c) => c.id === row.category) : undefined;
  const product = row.product ? catalog.products.find((p) => p.id === row.product) : undefined;
  const channel = row.channel ? catalog.channels.find((c) => c.id === row.channel) : undefined;

  return {
    ...summaryOf(row, catalog, implementation),
    description: row.description,
    category: category ? { id: category.id, name: category.name } : null,
    product: product ? { id: product.id, name: product.name } : null,
    channel: channel?.code ?? null,
    createdBy: ref(row.expand?.created_by),
    firstResponseAt: orNull(row.first_response_at),
    resolvedAt: orNull(row.resolved_at),
    closedAt: orNull(row.closed_at),
    transitions: availableTransitions(catalog, actor, row.status, "work_item").filter(
      (t) => !(t.to.category === "closed" && hasOpenStages(catalog, allStages)),
    ),
    stages: stageDtos,
    checklist: itemChecklist.map(toChecklistDto),
    clientRequests: requests
      .filter((r) => !actor.isClient || !r.stage || stages.some((s) => s.id === r.stage))
      .map(toClientRequestDto),
    attachments: attachments
      .filter((a) => attachmentVisible(actor, a, stages))
      .map(toAttachmentDto),
  };
}

/** Si el caso está "nuevo" y se le asigna alguien, pasa al primer estado "abierto" alcanzable. */
function assignedStatus(catalog: Catalog, fromStatusId: string): string | null {
  if (categoryOf(catalog, fromStatusId) !== "new") return null;
  const target = catalog
    .transitionsFrom(fromStatusId)
    .map((t) => catalog.statusById.get(t.to_status))
    .find((s) => s?.category === "open");
  return target?.id ?? null;
}

function priorityFor(catalog: Catalog, type: WorkItemTypeRow, priorityId: string | null | undefined): string {
  if (priorityId) {
    if (!catalog.priorityById.get(priorityId)?.active) throw Errors.validation([{ field: "priorityId", code: "invalid", message: "" }]);
    return priorityId;
  }
  return type.default_priority || catalog.priorities.find((p) => p.is_default)?.id || "";
}

export const workItemsService = {
  async list(actor: Actor, input: ListWorkItemsInput) {
    const catalog = await catalogCache.get();
    const criteria: WorkItemCriteria = {
      visibility: workItemVisibility(actor),
      categories: VIEW_CATEGORIES[input.view],
      statusId: input.statusId,
      search: input.q || undefined,
      clientId: actor.isClient ? undefined : input.clientId,
    };
    if (input.type) {
      const type = catalog.typeByCode(input.type);
      if (!type) return { items: [], page: input.page, perPage: input.perPage, totalItems: 0, totalPages: 0 };
      criteria.typeId = type.id;
    }
    if (input.assignee === "me") criteria.assigneeId = actor.userId;
    else if (input.assignee === "none") criteria.assigneeId = null;
    else if (input.assignee) criteria.assigneeId = input.assignee;

    const result = await workItemsModel.list(criteria, input.sort, input.page, input.perPage);
    const implementations = await implementationSummaries(actor, catalog, result.items);
    return {
      items: result.items.map((row) => summaryOf(row, catalog, implementations.get(row.id))),
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    };
  },

  /** Contadores de "Mi trabajo". */
  async summary(actor: Actor) {
    const visibility = workItemVisibility(actor);
    const requestScope = workItemVisibility(actor, "work_item.");
    const [assigned, waitingMe, overdue, waitingClient, toReview] = await Promise.all([
      actor.isClient ? Promise.resolve(0) : workItemsModel.count({ visibility, assigneeId: actor.userId, categories: OPEN_CATEGORIES }),
      actor.isClient
        ? clientRequestsModel.countActionable(OPEN_REQUEST_STATUSES, requestScope)
        : workItemsModel.count({ visibility, assigneeId: actor.userId, categories: ["new", "open"] }),
      workItemsModel.count({ visibility, categories: OPEN_CATEGORIES, dueBefore: new Date() }),
      clientRequestsModel.countActionable(OPEN_REQUEST_STATUSES, requestScope),
      actor.isClient ? Promise.resolve(0) : clientRequestsModel.countActionable(REVIEW_REQUEST_STATUSES, requestScope),
    ]);
    return { waitingMe, assigned, toReview, waitingClient, overdue };
  },

  async get(actor: Actor, id: string): Promise<WorkItemDetailDto> {
    return detailOf(actor, await loadVisibleWorkItem(actor, id));
  },

  async activity(actor: Actor, id: string): Promise<ActivityDto[]> {
    const row = await loadVisibleWorkItem(actor, id);
    const catalog = await catalogCache.get();
    const includeInternal = !actor.isClient && actor.can("comment.view_internal");
    const [comments, history, events] = await Promise.all([
      activityModel.comments(row.id, includeInternal),
      activityModel.statusHistory(row.id),
      activityModel.events(row.id),
    ]);
    const hiddenEvents = new Set(["work_item.status_changed", "comment.public_added"]);
    const clientVisibleEvents = new Set(catalog.eventTypes.filter((e) => e.client_visible).map((e) => e.code));

    const entries: ActivityDto[] = [
      ...comments.map((c): ActivityDto => ({
        kind: "comment",
        id: c.id,
        at: c.created,
        actor: ref(c.expand?.author),
        body: c.body,
        visibility: c.visibility,
      })),
      ...history.flatMap((h): ActivityDto[] => {
        const to = catalog.statusById.get(h.to_status);
        if (!to) return [];
        const from = h.from_status ? catalog.statusById.get(h.from_status) : undefined;
        return [{ kind: "status", id: h.id, at: h.created, actor: ref(h.expand?.changed_by), from: from ? toStatusDto(from) : null, to: toStatusDto(to) }];
      }),
      ...events.flatMap((e): ActivityDto[] => {
        const code = e.expand?.event_type?.code;
        if (!code || hiddenEvents.has(code) || (actor.isClient && !clientVisibleEvents.has(code))) return [];
        return [{ kind: "event", id: e.id, at: e.created, actor: ref(e.expand?.actor), event: code, data: e.metadata ?? {} }];
      }),
    ];
    return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  },

  async create(actor: Actor, input: CreateWorkItemInput): Promise<WorkItemDetailDto> {
    assertCan(actor, "work_item.create");
    const catalog = await catalogCache.get();
    const type = catalog.typeByCode(input.type);
    if (!type?.active) throw Errors.validation([{ field: "type", code: "invalid", message: "" }]);
    if (actor.isClient && (!type.client_visible || input.assigneeId || input.templateId || type.has_stages)) throw Errors.forbidden();
    if (type.has_stages && !actor.can("stage.manage")) throw Errors.forbidden();

    let requesterId = actor.userId;
    let clientId = actor.isClient ? actor.clientId : (input.clientId ?? null);
    if (actor.isClient && !clientId) throw Errors.forbidden();
    if (!actor.isClient && input.requesterId) {
      const requester = await usersService.findActive(input.requesterId, "requesterId");
      requesterId = requester.id;
      clientId ??= requester.client || null;
    }

    let assigneeId: string | null = null;
    if (input.assigneeId) {
      assertCan(actor, "work_item.assign");
      assigneeId = (await usersService.assertStaff(input.assigneeId)).id;
    }

    const initial = catalog.initialStatus(type.workflow);
    const status = (assigneeId && assignedStatus(catalog, initial.id)) || initial.id;
    const channel = catalog.channels.find((c) => c.code === (actor.isClient ? "portal" : "web"));
    const id = newRecordId();

    let plannedStart = input.plannedStart ?? null;
    let plannedEnd: string | null = null;
    const childOps: WriteOp[] = [];
    if (type.has_stages && input.templateId) {
      const bundle = await templatesModel.bundle(input.templateId);
      if (!bundle?.template.active || bundle.template.type !== type.id) {
        throw Errors.validation([{ field: "templateId", code: "invalid", message: "" }]);
      }
      const { calendar, holidays } = await templatesModel.defaultCalendar();
      const plan = planFromTemplate(bundle, {
        workItemId: id,
        startDay: plannedStart ?? toDay(new Date()),
        calendar: buildCalendar(calendar?.working_hours ?? null, holidays),
        initialStageStatus: catalog.initialStatus(type.stage_workflow).id,
        actorId: actor.userId,
      });
      childOps.push(...plan.ops);
      plannedStart = plan.plannedStart;
      plannedEnd = plan.plannedEnd;
    }

    const events: DomainEvent[] = [{ code: "work_item.created", workItemId: id, actorId: actor.userId, data: { type: type.code } }];
    const ops: WriteOp[] = [
      {
        op: "create",
        collection: "work_items",
        data: {
          id,
          type: type.id,
          title: input.title,
          description: input.description ?? "",
          status,
          priority: priorityFor(catalog, type, input.priorityId),
          category: input.categoryId ?? "",
          product: input.productId ?? "",
          client: clientId ?? "",
          channel: channel?.id ?? "",
          requester: requesterId,
          created_by: actor.userId,
          updated_by: actor.userId,
          assignee: assigneeId ?? "",
          template: input.templateId ?? "",
          parent: input.parentId ?? "",
          due_at: input.dueAt ? dayToPb(input.dueAt) : plannedEnd ? dayToPb(plannedEnd) : "",
          planned_start: plannedStart ? dayToPb(plannedStart) : "",
          planned_end: plannedEnd ? dayToPb(plannedEnd) : "",
        },
      },
      ...childOps,
    ];
    if (assigneeId) {
      ops.push({
        op: "create",
        collection: "work_item_assignments",
        data: { work_item: id, assignee: assigneeId, assigned_by: actor.userId, started_at: pbDate(new Date()) },
      });
      events.push({ code: "work_item.assigned", workItemId: id, actorId: actor.userId, data: { assigneeId } });
    }
    await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
    return this.get(actor, id);
  },

  async update(actor: Actor, id: string, input: UpdateWorkItemInput): Promise<WorkItemDetailDto> {
    assertCan(actor, "work_item.update");
    if (actor.isClient) throw Errors.forbidden();
    const row = await loadVisibleWorkItem(actor, id);
    const catalog = await catalogCache.get();
    const type = typeOf(catalog, row);
    const data: Record<string, unknown> = { updated_by: actor.userId };
    const ops: WriteOp[] = [];
    const events: DomainEvent[] = [];

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priorityId !== undefined) data.priority = priorityFor(catalog, type, input.priorityId);
    if (input.categoryId !== undefined) data.category = input.categoryId ?? "";
    if (input.productId !== undefined) data.product = input.productId ?? "";
    if (input.clientId !== undefined) data.client = input.clientId ?? "";
    if (input.dueAt !== undefined) data.due_at = input.dueAt ? dayToPb(input.dueAt) : "";

    if (input.assigneeId !== undefined && (input.assigneeId ?? "") !== row.assignee) {
      assertCan(actor, "work_item.assign");
      const assigneeId = input.assigneeId ? (await usersService.assertStaff(input.assigneeId)).id : "";
      data.assignee = assigneeId;
      const now = pbDate(new Date());
      for (const open of await workItemsModel.openAssignmentIds(row.id)) {
        ops.push({ op: "update", collection: "work_item_assignments", id: open, data: { ended_at: now } });
      }
      if (assigneeId) {
        ops.push({
          op: "create",
          collection: "work_item_assignments",
          data: { work_item: row.id, assignee: assigneeId, assigned_by: actor.userId, started_at: now },
        });
        events.push({ code: "work_item.assigned", workItemId: row.id, actorId: actor.userId, data: { assigneeId } });
        const next = assignedStatus(catalog, row.status);
        if (next) data.status = next;
      }
    }

    await unitOfWork.commit([{ op: "update", collection: "work_items", id: row.id, data }, ...ops, ...eventOps(catalog, events)]);
    return this.get(actor, id);
  },

  async transition(actor: Actor, id: string, input: TransitionInput): Promise<WorkItemDetailDto> {
    const row = await loadVisibleWorkItem(actor, id);
    const catalog = await catalogCache.get();
    const type = typeOf(catalog, row);
    const from = catalog.statusById.get(row.status);
    const to = catalog.statusById.get(input.statusId);
    if (!from || !to || to.workflow !== type.workflow) throw Errors.validation([{ field: "statusId", code: "invalid", message: "" }]);
    const transition = catalog.transition(from.id, to.id);
    if (!transition) throw Errors.conflict("workflow.invalid_transition");
    if (!canUseTransition(actor, transition, to, "work_item")) throw Errors.forbidden();
    if (transition.requires_comment && !input.comment) throw Errors.conflict("workflow.comment_required");
    if (type.has_stages && to.category === "closed" && hasOpenStages(catalog, await stagesModel.listByWorkItem(row.id))) {
      throw Errors.conflict("work_item.stages_pending");
    }

    const ops: WriteOp[] = [
      { op: "update", collection: "work_items", id: row.id, data: { status: to.id, updated_by: actor.userId } },
    ];
    const events: DomainEvent[] = [
      { code: "work_item.status_changed", workItemId: row.id, actorId: actor.userId, data: { from: from.code, to: to.code } },
    ];
    if (input.comment) {
      ops.push({
        op: "create",
        collection: "comments",
        data: { work_item: row.id, author: actor.userId, body: input.comment, visibility: actor.isClient ? "public" : "internal" },
      });
    }

    if (type.has_stages && from.category === "new" && to.category === "in_progress") {
      row.status = to.id;
      const plan = new ImplementationPlan(catalog, await loadImplementationState(row, type), actor.userId);
      plan.startRootStages();
      plan.syncItemStatus();
      ops.push(...plan.ops);
      events.push(...plan.events);
    }

    await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
    return this.get(actor, id);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertCan(actor, "work_item.delete");
    const row = await loadVisibleWorkItem(actor, id);
    await unitOfWork.commit([
      { op: "update", collection: "work_items", id: row.id, data: { deleted_at: pbDate(new Date()), updated_by: actor.userId } },
    ]);
  },
};
