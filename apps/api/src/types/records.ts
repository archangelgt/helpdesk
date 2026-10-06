import type { RecordModel } from "pocketbase";

/** Filas tal como las guarda PocketBase (snake_case). Los services las convierten a DTOs. */

export const STATUS_CATEGORIES = [
  "new",
  "open",
  "in_progress",
  "waiting_client",
  "waiting_internal",
  "resolved",
  "closed",
  "cancelled",
] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

/** Categorías que cuentan como "abierto" (falta trabajo). */
export const OPEN_CATEGORIES: StatusCategory[] = ["new", "open", "in_progress", "waiting_client", "waiting_internal"];
export const DONE_CATEGORIES: StatusCategory[] = ["resolved", "closed"];

export type ResponsibleSide = "internal" | "client" | "shared";
export const CLIENT_REQUEST_TYPES = ["information", "document", "data_upload", "access", "approval", "meeting"] as const;
export type ClientRequestType = (typeof CLIENT_REQUEST_TYPES)[number];
export type ClientRequestStatus = "pending" | "submitted" | "in_review" | "accepted" | "rejected" | "cancelled";
export const OPEN_REQUEST_STATUSES: ClientRequestStatus[] = ["pending", "rejected"];
export const REVIEW_REQUEST_STATUSES: ClientRequestStatus[] = ["submitted", "in_review"];

export interface UserRow extends RecordModel {
  email: string;
  name: string;
  role: string;
  client: string;
  status: string;
}

export interface ClientRow extends RecordModel {
  name: string;
  legal_name: string;
  tax_id: string;
  status: "active" | "inactive" | "prospect";
  default_language: string;
  notes: string;
}

export interface WorkflowRow extends RecordModel {
  code: string;
  name: string;
  applies_to: "work_item" | "stage";
}

export interface WorkItemTypeRow extends RecordModel {
  code: string;
  name: string;
  label_key: string;
  icon: string;
  color: string;
  number_prefix: string;
  has_stages: boolean;
  client_visible: boolean;
  requires_product: boolean;
  workflow: string;
  stage_workflow: string;
  default_priority: string;
  sort_order: number;
  active: boolean;
}

export interface StatusRow extends RecordModel {
  workflow: string;
  code: string;
  name: string;
  label_key: string;
  category: StatusCategory;
  client_label: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_final: boolean;
  pauses_sla: boolean;
  active: boolean;
}

export interface TransitionRow extends RecordModel {
  from_status: string;
  to_status: string;
  allowed_roles: string[];
  requires_comment: boolean;
  requires_evidence: boolean;
}

export interface PriorityRow extends RecordModel {
  code: string;
  name: string;
  label_key: string;
  level: number;
  color: string;
  is_default: boolean;
  active: boolean;
}

export interface NamedRow extends RecordModel {
  name: string;
  code?: string;
  type?: string;
  active?: boolean;
  sort_order?: number;
}

export interface EventTypeRow extends RecordModel {
  code: string;
  client_visible: boolean;
}

export interface WorkItemRow extends RecordModel {
  number: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  product: string;
  client: string;
  channel: string;
  requester: string;
  created_by: string;
  updated_by: string;
  assignee: string;
  team: string;
  template: string;
  due_at: string;
  planned_start: string;
  planned_end: string;
  first_response_at: string;
  resolved_at: string;
  closed_at: string;
  status_category: StatusCategory;
  progress_percent: number;
  parent: string;
  deleted_at: string;
  created: string;
  updated: string;
  expand?: {
    client?: ClientRow;
    assignee?: UserRow;
    requester?: UserRow;
    created_by?: UserRow;
  };
}

export interface StageRow extends RecordModel {
  work_item: string;
  template_stage: string;
  name: string;
  description: string;
  sort_order: number;
  status: string;
  responsible_side: ResponsibleSide;
  owner: string;
  planned_start: string;
  planned_end: string;
  started_at: string;
  completed_at: string;
  completed_by: string;
  weight: number;
  client_visible: boolean;
  requires_evidence: boolean;
  requires_client_approval: boolean;
  expand?: { owner?: UserRow };
}

export interface StageDependencyRow extends RecordModel {
  stage: string;
  depends_on: string;
}

export interface ChecklistItemRow extends RecordModel {
  work_item: string;
  stage: string;
  title: string;
  sort_order: number;
  is_done: boolean;
  done_by: string;
  done_at: string;
}

export interface ClientRequestRow extends RecordModel {
  work_item: string;
  stage: string;
  title: string;
  description: string;
  request_type: ClientRequestType;
  requested_by: string;
  contact: string;
  due_at: string;
  blocking: boolean;
  status: ClientRequestStatus;
  submitted_at: string;
  reviewed_by: string;
  reviewed_at: string;
  rejection_reason: string;
  created: string;
}

export interface CommentRow extends RecordModel {
  work_item: string;
  stage: string;
  client_request: string;
  author: string;
  body: string;
  visibility: "public" | "internal";
  created: string;
  expand?: { author?: UserRow };
}

export interface AttachmentRow extends RecordModel {
  work_item: string;
  comment: string;
  stage: string;
  client_request: string;
  file: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  purpose: "general" | "evidence" | "client_submission" | "template_file";
  uploaded_by: string;
  created: string;
  expand?: {
    uploaded_by?: UserRow;
    comment?: CommentRow;
    stage?: Pick<StageRow, "work_item">;
    client_request?: Pick<ClientRequestRow, "work_item" | "stage">;
  };
}

export interface StatusHistoryRow extends RecordModel {
  work_item: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  seconds_in_previous: number;
  created: string;
  expand?: { changed_by?: UserRow };
}

export interface WorkItemEventRow extends RecordModel {
  work_item: string;
  event_type: string;
  actor: string;
  new_value: unknown;
  metadata: Record<string, unknown> | null;
  created: string;
  expand?: { actor?: UserRow; event_type?: EventTypeRow };
}

export interface TemplateRow extends RecordModel {
  type: string;
  product: string;
  name: string;
  description: string;
  active: boolean;
}

export interface TemplateStageRow extends RecordModel {
  template: string;
  name: string;
  description: string;
  sort_order: number;
  duration_days: number;
  responsible_side: ResponsibleSide;
  weight: number;
  client_visible: boolean;
  requires_evidence: boolean;
  requires_client_approval: boolean;
}

export interface TemplateStageDependencyRow extends RecordModel {
  stage: string;
  depends_on: string;
}

export interface TemplateChecklistRow extends RecordModel {
  stage: string;
  title: string;
  sort_order: number;
}

export interface TemplateClientRequestRow extends RecordModel {
  stage: string;
  title: string;
  description: string;
  request_type: ClientRequestType;
  blocking: boolean;
  due_in_days: number;
  sort_order: number;
}

export interface CalendarRow extends RecordModel {
  timezone: string;
  working_hours: Record<string, [string, string][]>;
}

export interface HolidayRow extends RecordModel {
  day: string;
}
