import type { AttachmentRow, StageRow } from "../types/records.js";
import type { Actor } from "./actor.service.js";

/** Tamaño máximo de un adjunto (debe coincidir con el mensaje attachment.too_large). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Un cliente no ve adjuntos de comentarios internos ni de etapas que no le son visibles. */
export function attachmentVisible(actor: Actor, attachment: AttachmentRow, visibleStages: Pick<StageRow, "id">[]): boolean {
  if (!actor.isClient) return true;
  if (attachment.comment && attachment.expand?.comment?.visibility !== "public") return false;
  if (attachment.stage && !visibleStages.some((s) => s.id === attachment.stage)) return false;
  return true;
}
