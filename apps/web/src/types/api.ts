/** Formas que devuelve la API (copia de apps/api/src/types/dto.ts). */

export type StatusCategory =
  | "new"
  | "open"
  | "in_progress"
  | "waiting_client"
  | "waiting_internal"
  | "resolved"
  | "closed"
  | "cancelled";
export type ResponsibleSide = "internal" | "client" | "shared";
export type ClientRequestStatus = "pending" | "submitted" | "in_review" | "accepted" | "rejected" | "cancelled";
export type ClientRequestType = "information" | "document" | "data_upload" | "approval" | "meeting" | "access" | "payment";
export type WorkItemView = "open" | "waiting_client" | "done" | "all";

export interface Ref {
  id: string;
  name: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
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
  type: { id: string; code: string; name: string; color: string; icon: string; hasStages: boolean };
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

export interface WorkSummaryDto {
  waitingMe: number;
  assigned: number;
  toReview: number;
  waitingClient: number;
  overdue: number;
}

export interface ClientDto {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  status: "active" | "inactive" | "prospect";
  notes: string | null;
  openItems: number;
  userCount: number;
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

export interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  typeId: string;
  stageCount: number;
}

export interface NotificationsStatusDto {
  smtp: { transport: "api" | "smtp"; host: string; port: number; secure: boolean; user: string; from: string; ready: boolean };
  sender: { id: string; name: string; email: string; spfOk: boolean; dkimOk: boolean } | null;
  emailChannelActive: boolean;
  notifications: Record<"pending" | "sent" | "failed" | "skipped", number>;
  outbox: Record<"pending" | "failed" | "dead", number>;
  recent: {
    id: string;
    to: string;
    subject: string;
    status: "pending" | "sent" | "failed" | "skipped";
    attempts: number;
    error: string;
    created: string;
    sentAt: string | null;
  }[];
}

export type RoleScope = "staff" | "client";
export type UserStatus = "active" | "invited" | "suspended";

export interface RoleOption {
  id: string;
  code: string;
  name: string;
  scope: RoleScope;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: RoleOption | null;
  client: { id: string; name: string } | null;
  status: UserStatus;
  language: "es" | "en" | "pt" | null;
  lastSeenAt: string | null;
  created: string;
  receivesNotifications: boolean;
}

export interface AdminUserDetailDto extends AdminUserDto {
  openAssigned: number;
  requested: number;
  activeSessions: number;
}

export interface AccessResult {
  temporaryPassword: string | null;
  emailSent: boolean;
  emailError: string | null;
}

export type ThemeName = "blue" | "orange" | "green" | "purple" | "pink" | "slate";
export type LanguageCode = "es" | "en" | "pt";

export interface PublicSettingsDto {
  companyName: string;
  theme: ThemeName;
  colorMode: "light" | "dark" | "system";
  defaultLanguage: LanguageCode;
  languages: LanguageCode[];
  maxUploadMb: number;
}

export interface InstanceSettingsValues extends PublicSettingsDto {
  timezone: string;
  brandColor: string;
}

export type RecipientKind =
  | "requester"
  | "assignee"
  | "stage_owner"
  | "client_contacts"
  | "account_manager"
  | "team"
  | "participants"
  | "managers";

export interface NotificationRuleDto {
  id: string;
  event: string;
  clientVisible: boolean;
  recipients: RecipientKind[];
  active: boolean;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface CalendarDto {
  id: string;
  name: string;
  timezone: string;
  workingDays: Weekday[];
  holidays: { id: string; day: string; name: string }[];
}

export interface SenderDto {
  id: string;
  name: string;
  fromEmail: string;
  replyTo: string | null;
  provider: string;
}

export interface SettingsDto {
  values: InstanceSettingsValues;
  calendar: CalendarDto | null;
  rules: NotificationRuleDto[];
  sender: SenderDto | null;
  recipientKinds: RecipientKind[];
}

export interface ReportDto {
  period: { from: string; to: string };
  summary: {
    created: number;
    resolved: number;
    open: number;
    overdue: number;
    unassigned: number;
    waitingClient: number;
    avgFirstResponseHours: number | null;
    avgResolutionHours: number | null;
  };
  byType: { typeId: string; code: string; name: string; created: number; resolved: number; open: number; overdue: number; avgResolutionHours: number | null }[];
  trend: { date: string; created: number; resolved: number }[];
  byClient: { clientId: string; name: string; created: number; resolved: number; open: number; overdue: number }[];
  byAssignee: { userId: string; name: string; open: number; overdue: number; resolved: number; avgResolutionHours: number | null; stagesCompleted: number }[];
  unassignedOpen: number;
  byRequester: { userId: string; name: string; clientName: string | null; created: number }[];
  implementations: {
    totals: { active: number; delayed: number; avgProgress: number | null; clientDelayDays: number; internalDelayDays: number };
    items: {
      id: string;
      number: string;
      title: string;
      clientName: string | null;
      assigneeName: string | null;
      statusCategory: string;
      progress: number;
      dueAt: string | null;
      stagesTotal: number;
      stagesDone: number;
      delayedStages: number;
      clientDelayDays: number;
      internalDelayDays: number;
      pendingRequests: number;
      overdueRequests: number;
    }[];
  };
  clientRequests: { clientId: string; name: string; pending: number; overdue: number; inReview: number; avgDeliveryDays: number | null; rejected: number }[];
}
