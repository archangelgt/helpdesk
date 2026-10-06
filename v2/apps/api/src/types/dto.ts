import type { ClientRequestStatus, ClientRequestType, ResponsibleSide, StatusCategory } from "./records.js";

/** Formas que devuelve la API (camelCase). La web tiene su copia en apps/web/src/types/api.ts. */

export interface Ref {
  id: string;
  name: string;
}

export interface StatusDto {
  id: string;
  code: string;
  name: string;
  labelKey: string;
  category: StatusCategory;
  clientLabel: string | null;
  color: string;
  order: number;
  isInitial: boolean;
  isFinal: boolean;
}

export interface PriorityDto {
  id: string;
  code: string;
  name: string;
  labelKey: string;
  level: number;
  color: string;
  isDefault: boolean;
}

export interface TypeDto {
  id: string;
  code: string;
  name: string;
  labelKey: string;
  icon: string;
  color: string;
  numberPrefix: string;
  hasStages: boolean;
  clientVisible: boolean;
}

export interface TransitionDto {
  to: StatusDto;
  requiresComment: boolean;
}

export interface ImplementationSummaryDto {
  currentStage: { id: string; order: number; name: string } | null;
  stageCount: number;
  completedStages: number;
  openRequests: number;
  requestsToReview: number;
}

export interface WorkItemSummaryDto {
  id: string;
  number: string;
  title: string;
  type: Pick<TypeDto, "id" | "code" | "name" | "color" | "icon" | "hasStages">;
  status: StatusDto;
  priority: PriorityDto | null;
  client: Ref | null;
  assignee: Ref | null;
  requester: Ref | null;
  dueAt: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  progressPercent: number;
  created: string;
  updated: string;
  implementation?: ImplementationSummaryDto;
}

export interface ChecklistItemDto {
  id: string;
  title: string;
  isDone: boolean;
  doneAt: string | null;
}

export interface StageDto {
  id: string;
  order: number;
  name: string;
  description: string;
  status: StatusDto;
  side: ResponsibleSide;
  owner: Ref | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  startedAt: string | null;
  completedAt: string | null;
  weight: number;
  progress: number;
  clientVisible: boolean;
  requiresEvidence: boolean;
  requiresClientApproval: boolean;
  dependsOn: string[];
  checklist: ChecklistItemDto[];
  transitions: TransitionDto[];
}

export interface ClientRequestDto {
  id: string;
  stageId: string | null;
  title: string;
  description: string;
  type: ClientRequestType;
  status: ClientRequestStatus;
  blocking: boolean;
  dueAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface WorkItemDetailDto extends WorkItemSummaryDto {
  description: string;
  category: Ref | null;
  product: Ref | null;
  channel: string | null;
  createdBy: Ref | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  transitions: TransitionDto[];
  stages: StageDto[];
  checklist: ChecklistItemDto[];
  clientRequests: ClientRequestDto[];
  attachments: AttachmentDto[];
}

export interface AttachmentDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  stageId: string | null;
  clientRequestId: string | null;
  uploadedBy: Ref | null;
  created: string;
  url: string;
}

export type ActivityDto =
  | { kind: "comment"; id: string; at: string; actor: Ref | null; body: string; visibility: "public" | "internal" }
  | { kind: "status"; id: string; at: string; actor: Ref | null; from: StatusDto | null; to: StatusDto }
  | { kind: "event"; id: string; at: string; actor: Ref | null; event: string; data: Record<string, unknown> };
