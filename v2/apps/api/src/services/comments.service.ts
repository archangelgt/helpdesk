import { newRecordId, pbDate } from "../db/pocketbase.js";
import { unitOfWork, type WriteOp } from "../models/unit-of-work.model.js";
import type { ActivityDto } from "../types/dto.js";
import { Errors } from "../utils/errors.js";
import type { CommentInput } from "../validators/work-items.validators.js";
import { assertCan, type Actor } from "./actor.service.js";
import { catalogCache } from "./catalog-cache.service.js";
import { eventOps, type DomainEvent } from "./events.js";
import { loadVisibleWorkItem, workItemsService } from "./work-items.service.js";
import { canUseTransition } from "./workflow.js";

export const commentsService = {
  async create(actor: Actor, workItemId: string, input: CommentInput): Promise<ActivityDto[]> {
    if (input.stageId && actor.isClient) throw Errors.forbidden();
    const visibility = actor.isClient ? "public" : input.visibility;
    assertCan(actor, visibility === "public" ? "comment.create_public" : "comment.create_internal");
    const item = await loadVisibleWorkItem(actor, workItemId);
    const catalog = await catalogCache.get();

    const commentId = newRecordId();
    const ops: WriteOp[] = [
      {
        op: "create",
        collection: "comments",
        data: {
          id: commentId,
          work_item: item.id,
          stage: input.stageId ?? "",
          client_request: input.clientRequestId ?? "",
          author: actor.userId,
          body: input.body,
          visibility,
        },
      },
    ];
    const events: DomainEvent[] = [];
    if (visibility === "public") {
      events.push({
        code: "comment.public_added",
        workItemId: item.id,
        actorId: actor.userId,
        data: { byClient: actor.isClient, commentId, excerpt: input.body.slice(0, 1000) },
      });
    }

    const itemUpdate: Record<string, unknown> = {};
    if (!actor.isClient && visibility === "public" && !item.first_response_at) itemUpdate.first_response_at = pbDate(new Date());

    // Si el caso esperaba al cliente y el cliente responde, vuelve a nuestro equipo (si el flujo lo permite).
    const current = catalog.statusById.get(item.status);
    if (actor.isClient && current?.category === "waiting_client") {
      const back = catalog
        .transitionsFrom(item.status)
        .map((tr) => ({ tr, to: catalog.statusById.get(tr.to_status) }))
        .find(({ tr, to }) => to?.category === "in_progress" && canUseTransition(actor, tr, to, "work_item"));
      if (back?.to) {
        itemUpdate.status = back.to.id;
        events.push({ code: "work_item.status_changed", workItemId: item.id, actorId: actor.userId, data: { from: current.code, to: back.to.code, automatic: true } });
      }
    }
    if (Object.keys(itemUpdate).length) {
      ops.push({ op: "update", collection: "work_items", id: item.id, data: { ...itemUpdate, updated_by: actor.userId } });
    }

    await unitOfWork.commit([...ops, ...eventOps(catalog, events)]);
    return workItemsService.activity(actor, item.id);
  },
};
