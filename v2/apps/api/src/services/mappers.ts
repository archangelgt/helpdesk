import type {
  AttachmentDto,
  ChecklistItemDto,
  ClientRequestDto,
  PriorityDto,
  Ref,
  StatusDto,
  TypeDto,
} from "../types/dto.js";
import type {
  AttachmentRow,
  ChecklistItemRow,
  ClientRequestRow,
  PriorityRow,
  StatusRow,
  UserRow,
  WorkItemTypeRow,
} from "../types/records.js";

/** "" (vacío en PocketBase) → null. */
export function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

export function ref(row: { id: string; name: string } | undefined | null): Ref | null {
  return row?.id ? { id: row.id, name: row.name || (row as Partial<UserRow>).email || "" } : null;
}

export function toStatusDto(s: StatusRow): StatusDto {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    labelKey: s.label_key,
    category: s.category,
    clientLabel: orNull(s.client_label),
    color: s.color,
    order: s.sort_order,
    isInitial: s.is_initial,
    isFinal: s.is_final,
  };
}

export function toPriorityDto(p: PriorityRow): PriorityDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    labelKey: p.label_key,
    level: p.level,
    color: p.color,
    isDefault: p.is_default,
  };
}

export function toTypeDto(t: WorkItemTypeRow): TypeDto {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    labelKey: t.label_key,
    icon: t.icon,
    color: t.color,
    numberPrefix: t.number_prefix,
    hasStages: t.has_stages,
    clientVisible: t.client_visible,
  };
}

export function toChecklistDto(c: ChecklistItemRow): ChecklistItemDto {
  return { id: c.id, title: c.title, isDone: c.is_done, doneAt: orNull(c.done_at) };
}

export function toClientRequestDto(r: ClientRequestRow): ClientRequestDto {
  return {
    id: r.id,
    stageId: orNull(r.stage),
    title: r.title,
    description: r.description,
    type: r.request_type,
    status: r.status,
    blocking: r.blocking,
    dueAt: orNull(r.due_at),
    submittedAt: orNull(r.submitted_at),
    reviewedAt: orNull(r.reviewed_at),
    rejectionReason: orNull(r.rejection_reason),
  };
}

export function toAttachmentDto(a: AttachmentRow): AttachmentDto {
  return {
    id: a.id,
    name: a.original_name || a.file,
    mimeType: a.mime_type,
    size: a.size_bytes,
    stageId: orNull(a.stage),
    clientRequestId: orNull(a.client_request),
    uploadedBy: ref(a.expand?.uploaded_by),
    created: a.created,
    url: `/api/v1/attachments/${a.id}/download`,
  };
}
