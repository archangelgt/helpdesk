import { attachmentsModel } from "../models/attachments.model.js";
import { clientRequestsModel } from "../models/client-requests.model.js";
import { stagesModel } from "../models/stages.model.js";
import type { AttachmentDto } from "../types/dto.js";
import { Errors } from "../utils/errors.js";
import { assertCan, type Actor } from "./actor.service.js";
import { attachmentVisible } from "./attachment-rules.js";
import { toAttachmentDto } from "./mappers.js";
import { loadVisibleWorkItem } from "./work-items.service.js";

export interface UploadedFile {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

export interface UploadTarget {
  stageId?: string;
  clientRequestId?: string;
}

async function loadVisibleAttachment(actor: Actor, id: string) {
  const row = await attachmentsModel.findById(id);
  if (!row?.work_item) throw Errors.notFound();
  await loadVisibleWorkItem(actor, row.work_item);
  const stages = row.stage ? (await stagesModel.listByWorkItem(row.work_item)).filter((s) => !actor.isClient || s.client_visible) : [];
  if (!attachmentVisible(actor, row, stages)) throw Errors.notFound();
  return row;
}

export const attachmentsService = {
  async upload(actor: Actor, workItemId: string, file: UploadedFile, target: UploadTarget): Promise<AttachmentDto> {
    assertCan(actor, "comment.create_public");
    const item = await loadVisibleWorkItem(actor, workItemId);

    if (target.stageId) {
      if (actor.isClient) throw Errors.forbidden();
      const stage = await stagesModel.findById(target.stageId);
      if (stage?.work_item !== item.id) throw Errors.validation([{ field: "stageId", code: "invalid", message: "" }]);
    }
    if (target.clientRequestId) {
      const request = await clientRequestsModel.findById(target.clientRequestId);
      if (request?.work_item !== item.id) throw Errors.validation([{ field: "clientRequestId", code: "invalid", message: "" }]);
    }

    const row = await attachmentsModel.create({
      workItemId: item.id,
      stageId: target.stageId,
      clientRequestId: target.clientRequestId,
      purpose: target.clientRequestId && actor.isClient ? "client_submission" : target.stageId ? "evidence" : "general",
      uploadedBy: actor.userId,
      ...file,
    });
    return toAttachmentDto((await attachmentsModel.findById(row.id)) ?? row);
  },

  async download(actor: Actor, id: string) {
    const row = await loadVisibleAttachment(actor, id);
    const response = await attachmentsModel.download(row);
    if (!response.ok || !response.body) throw Errors.notFound();
    return { name: row.original_name || row.file, mimeType: row.mime_type || "application/octet-stream", body: response.body };
  },

  async remove(actor: Actor, id: string): Promise<void> {
    const row = await loadVisibleAttachment(actor, id);
    const isOwner = row.uploaded_by === actor.userId;
    if (!isOwner && (actor.isClient || !actor.can("work_item.update"))) throw Errors.forbidden();
    await attachmentsModel.remove(row.id);
  },
};
