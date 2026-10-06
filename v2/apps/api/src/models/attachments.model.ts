import { ClientResponseError } from "pocketbase";
import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { AttachmentRow } from "../types/records.js";

export interface NewAttachment {
  workItemId: string;
  stageId?: string;
  clientRequestId?: string;
  purpose: AttachmentRow["purpose"];
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
}

const EXPAND = "uploaded_by,comment,stage,client_request";
const FIELDS =
  "*,expand.uploaded_by.id,expand.uploaded_by.name,expand.comment.visibility,expand.comment.work_item," +
  "expand.stage.work_item,expand.client_request.work_item,expand.client_request.stage";

/** Cada adjunto tiene un solo dueño (caso, comentario, etapa o requerimiento); el caso se deduce del dueño. */
function withWorkItem(row: AttachmentRow): AttachmentRow {
  const e = row.expand;
  row.work_item ||= e?.stage?.work_item || e?.client_request?.work_item || e?.comment?.work_item || "";
  row.stage ||= e?.client_request?.stage || "";
  return row;
}

/** Archivos de los casos. El archivo está protegido en PocketBase: solo se descarga a través de la API. */
export const attachmentsModel = {
  async listByWorkItem(workItemId: string): Promise<AttachmentRow[]> {
    await ensureAdminAuth();
    const rows = await pb.collection("attachments").getFullList<AttachmentRow>({
      filter: pb.filter("work_item = {:id} || stage.work_item = {:id} || client_request.work_item = {:id} || comment.work_item = {:id}", {
        id: workItemId,
      }),
      sort: "created",
      expand: EXPAND,
      fields: FIELDS,
    });
    return rows.map(withWorkItem);
  },

  async findById(id: string): Promise<AttachmentRow | null> {
    await ensureAdminAuth();
    try {
      return withWorkItem(await pb.collection("attachments").getOne<AttachmentRow>(id, { expand: EXPAND, fields: FIELDS }));
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  },

  async create(input: NewAttachment): Promise<AttachmentRow> {
    await ensureAdminAuth();
    const form = new FormData();
    if (input.clientRequestId) form.append("client_request", input.clientRequestId);
    else if (input.stageId) form.append("stage", input.stageId);
    else form.append("work_item", input.workItemId);
    form.append("purpose", input.purpose);
    form.append("uploaded_by", input.uploadedBy);
    form.append("original_name", input.fileName);
    form.append("mime_type", input.mimeType);
    form.append("size_bytes", String(input.content.length));
    form.append("file", new Blob([input.content], { type: input.mimeType }), input.fileName);
    return pb.collection("attachments").create<AttachmentRow>(form);
  },

  async remove(id: string): Promise<void> {
    await ensureAdminAuth();
    await pb.collection("attachments").delete(id);
  },

  /** Descarga el archivo desde PocketBase con un token de archivo de superusuario (válido unos minutos). */
  async download(row: AttachmentRow): Promise<Response> {
    await ensureAdminAuth();
    const token = await pb.files.getToken();
    return fetch(pb.files.getURL(row, row.file, { token }));
  },
};
