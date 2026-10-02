import { pbDate } from "../db/pocketbase.js";
import { clientRequestsModel } from "../models/client-requests.model.js";
import { unitOfWork, type WriteOp } from "../models/unit-of-work.model.js";
import type { WorkItemDetailDto } from "../types/dto.js";
import { dayToPb } from "../utils/business-days.js";
import { Errors } from "../utils/errors.js";
import type { CreateClientRequestInput, ReviewClientRequestInput } from "../validators/work-items.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";
import { eventOps, type DomainEvent } from "./events.js";
import { ImplementationPlan, loadImplementationState } from "./implementation-engine.js";
import { loadVisibleWorkItem, workItemsService } from "./work-items.service.js";

async function context(actor: Actor, workItemId: string) {
  const item = await loadVisibleWorkItem(actor, workItemId);
  const catalog = await catalogCache.get();
  const type = catalog.typeById.get(item.type);
  if (!type) throw Errors.notFound();
  const plan = type.has_stages ? new ImplementationPlan(catalog, await loadImplementationState(item, type), actor.userId) : null;
  return { item, catalog, plan };
}

async function loadRequest(actor: Actor, requestId: string) {
  const request = await clientRequestsModel.findById(requestId);
  if (!request || request.status === "cancelled") throw Errors.notFound();
  const ctx = await context(actor, request.work_item);
  return { ...ctx, request: ctx.plan?.state.requests.find((r) => r.id === request.id) ?? request };
}

export const clientRequestsService = {
  async create(actor: Actor, workItemId: string, input: CreateClientRequestInput): Promise<WorkItemDetailDto> {
    assertCan(actor, "client_request.create");
    if (actor.isClient) throw Errors.forbidden();
    const { item, catalog, plan } = await context(actor, workItemId);
    const stage = input.stageId ? plan?.state.stages.find((s) => s.id === input.stageId) : undefined;
    if (input.stageId && !stage) throw Errors.validation([{ field: "stageId", code: "invalid", message: "" }]);

    const ops: WriteOp[] = [
      {
        op: "create",
        collection: "client_requests",
        data: {
          work_item: item.id,
          stage: stage?.id ?? "",
          title: input.title,
          description: input.description ?? "",
          request_type: input.type,
          requested_by: actor.userId,
          due_at: input.dueAt ? dayToPb(input.dueAt) : "",
          blocking: input.blocking,
          status: "pending",
          reminders_sent: 0,
        },
      },
    ];
    const events: DomainEvent[] = [];
    const stageStarted = stage && plan && plan.category(stage) !== "new";
    if (!stage || stageStarted) {
      events.push({ code: "client_request.created", workItemId: item.id, actorId: actor.userId, data: { request: input.title, stageId: stage?.id ?? null } });
    }
    if (stage && plan && input.blocking) {
      plan.state.requests.push({ stage: stage.id, blocking: true, status: "pending" } as (typeof plan.state.requests)[number]);
      plan.refreshWaiting(stage);
      plan.syncItemStatus();
      ops.push(...plan.ops);
      events.push(...plan.events);
    }
    await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
    return workItemsService.get(actor, item.id);
  },

  /** El cliente entrega lo pedido (los archivos llegan con los adjuntos). */
  async submit(actor: Actor, requestId: string, note?: string): Promise<WorkItemDetailDto> {
    assertCan(actor, "client_request.submit");
    const { item, catalog, request } = await loadRequest(actor, requestId);
    if (!["pending", "rejected"].includes(request.status)) throw Errors.conflict("client_request.invalid_state");

    const ops: WriteOp[] = [
      { op: "update", collection: "client_requests", id: request.id, data: { status: "submitted", submitted_at: pbDate(new Date()) } },
    ];
    if (note) {
      ops.push({
        op: "create",
        collection: "comments",
        data: { work_item: item.id, client_request: request.id, author: actor.userId, body: note, visibility: "public" },
      });
    }
    const events: DomainEvent[] = [
      { code: "client_request.submitted", workItemId: item.id, actorId: actor.userId, data: { requestId: request.id, request: request.title } },
    ];
    await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
    return workItemsService.get(actor, item.id);
  },

  /** Nuestro equipo acepta o rechaza la entrega; al aceptar lo último obligatorio, la etapa sigue. */
  async review(actor: Actor, requestId: string, input: ReviewClientRequestInput): Promise<WorkItemDetailDto> {
    assertCan(actor, "client_request.review");
    if (actor.isClient) throw Errors.forbidden();
    const { item, catalog, plan, request } = await loadRequest(actor, requestId);
    if (!["pending", "submitted", "in_review", "rejected"].includes(request.status)) throw Errors.conflict("client_request.invalid_state");

    const accepted = input.decision === "accept";
    request.status = accepted ? "accepted" : "rejected";
    const ops: WriteOp[] = [
      {
        op: "update",
        collection: "client_requests",
        id: request.id,
        data: {
          status: request.status,
          reviewed_by: actor.userId,
          reviewed_at: pbDate(new Date()),
          rejection_reason: accepted ? "" : (input.reason ?? ""),
        },
      },
    ];
    const events: DomainEvent[] = [
      {
        code: accepted ? "client_request.accepted" : "client_request.rejected",
        workItemId: item.id,
        actorId: actor.userId,
        data: { requestId: request.id, request: request.title, ...(accepted ? {} : { reason: input.reason }) },
      },
    ];
    const stage = request.stage ? plan?.state.stages.find((s) => s.id === request.stage) : undefined;
    if (plan && stage) {
      plan.refreshWaiting(stage);
      plan.syncItemStatus();
      ops.push(...plan.ops);
      events.push(...plan.events);
    }
    await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
    return workItemsService.get(actor, item.id);
  },
};
