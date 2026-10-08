import { api, apiBlob } from "./client";
import type {
  AccessResult,
  ActivityDto,
  AdminUserDetailDto,
  AdminUserDto,
  CalendarDto,
  InstanceSettingsValues,
  NotificationRuleDto,
  PublicSettingsDto,
  RecipientKind,
  ReportDto,
  RoleOption,
  SenderDto,
  SettingsDto,
  Weekday,
  AttachmentDto,
  ClientDto,
  ClientRequestType,
  NotificationsStatusDto,
  ResponsibleSide,
  Page,
  PriorityDto,
  TemplateDto,
  UserOption,
  WorkItemDetailDto,
  WorkItemSummaryDto,
  WorkItemView,
  WorkSummaryDto,
} from "../types/api";

export interface WorkItemQuery {
  type?: string;
  view?: WorkItemView;
  assignee?: "me" | "none" | string;
  clientId?: string;
  q?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export interface CreateWorkItemBody {
  type: string;
  title: string;
  description?: string;
  priorityId?: string | null;
  clientId?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  templateId?: string | null;
  plannedStart?: string | null;
}

export type UpdateWorkItemBody = Partial<
  Pick<CreateWorkItemBody, "title" | "description" | "priorityId" | "clientId" | "assigneeId" | "dueAt">
>;

export interface CreateStageBody {
  name: string;
  description?: string;
  side: ResponsibleSide;
  ownerId?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  dependsOnPrevious: boolean;
}

export type UpdateStageBody = Partial<Pick<CreateStageBody, "name" | "description" | "ownerId" | "plannedStart" | "plannedEnd">>;

export interface CreateClientRequestBody {
  title: string;
  description?: string;
  type: ClientRequestType;
  stageId?: string | null;
  dueAt?: string | null;
  blocking: boolean;
}

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined && { body: JSON.stringify(body) }),
});

export const workItemsApi = {
  list: (params: WorkItemQuery) => api<Page<WorkItemSummaryDto>>(`/work-items${query(params)}`),
  summary: () => api<WorkSummaryDto>("/work-items/summary"),
  get: (id: string) => api<WorkItemDetailDto>(`/work-items/${id}`),
  create: (body: CreateWorkItemBody) => api<WorkItemDetailDto>("/work-items", json("POST", body)),
  update: (id: string, body: UpdateWorkItemBody) => api<WorkItemDetailDto>(`/work-items/${id}`, json("PATCH", body)),
  transition: (id: string, statusId: string, comment?: string) =>
    api<WorkItemDetailDto>(`/work-items/${id}/transition`, json("POST", { statusId, ...(comment && { comment }) })),
  activity: (id: string) => api<{ items: ActivityDto[] }>(`/work-items/${id}/activity`).then((r) => r.items),
  comment: (id: string, body: string, visibility: "public" | "internal") =>
    api<{ items: ActivityDto[] }>(`/work-items/${id}/comments`, json("POST", { body, visibility })).then((r) => r.items),
  addChecklistItem: (id: string, title: string) => api<WorkItemDetailDto>(`/work-items/${id}/checklist`, json("POST", { title })),
  addStage: (id: string, body: CreateStageBody) => api<WorkItemDetailDto>(`/work-items/${id}/stages`, json("POST", body)),
  addClientRequest: (id: string, body: CreateClientRequestBody) =>
    api<WorkItemDetailDto>(`/work-items/${id}/client-requests`, json("POST", body)),
};

export const attachmentsApi = {
  upload: (workItemId: string, file: File, target: { stageId?: string; clientRequestId?: string } = {}) => {
    const form = new FormData();
    if (target.stageId) form.append("stageId", target.stageId);
    if (target.clientRequestId) form.append("clientRequestId", target.clientRequestId);
    form.append("file", file, file.name);
    return api<AttachmentDto>(`/work-items/${workItemId}/attachments`, { method: "POST", body: form });
  },
  download: (id: string) => apiBlob(`/attachments/${id}/download`),
  remove: (id: string) => api<void>(`/attachments/${id}`, { method: "DELETE" }),
};

export const stagesApi = {
  update: (id: string, body: UpdateStageBody) => api<WorkItemDetailDto>(`/stages/${id}`, json("PATCH", body)),
  transition: (id: string, statusId: string, comment?: string) =>
    api<WorkItemDetailDto>(`/stages/${id}/transition`, json("POST", { statusId, ...(comment && { comment }) })),
  addChecklistItem: (id: string, title: string) => api<WorkItemDetailDto>(`/stages/${id}/checklist`, json("POST", { title })),
  setChecklistDone: (itemId: string, isDone: boolean) =>
    api<WorkItemDetailDto>(`/checklist-items/${itemId}`, json("PATCH", { isDone })),
};

export const clientRequestsApi = {
  submit: (id: string, note?: string) =>
    api<WorkItemDetailDto>(`/client-requests/${id}/submit`, json("POST", note ? { note } : {})),
  review: (id: string, decision: "accept" | "reject", reason?: string) =>
    api<WorkItemDetailDto>(`/client-requests/${id}/review`, json("POST", { decision, ...(reason && { reason }) })),
};

export const adminApi = {
  clients: (q?: string) => api<{ items: ClientDto[] }>(`/clients${query({ q })}`).then((r) => r.items),
  createClient: (body: { name: string; legalName?: string; taxId?: string }) => api<ClientDto>("/clients", json("POST", body)),
  updateClient: (id: string, body: Partial<Pick<ClientDto, "name" | "status">> & { legalName?: string; taxId?: string; notes?: string }) =>
    api<ClientDto>(`/clients/${id}`, json("PATCH", body)),
  assignableUsers: () => api<{ items: UserOption[] }>("/users/assignable").then((r) => r.items),
  templates: (type: string) => api<{ items: TemplateDto[] }>(`/templates${query({ type })}`).then((r) => r.items),
  priorities: () => api<{ items: PriorityDto[] }>("/catalog/priorities").then((r) => r.items),
  notificationsStatus: () => api<NotificationsStatusDto>("/notifications/status"),
  sendTestEmail: (to: string) =>
    api<{ ok: boolean; error?: string; messageId?: string }>("/notifications/test", json("POST", { to })),
};

export const meApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ closedSessions: number }>("/me/password", json("POST", { currentPassword, newPassword })),
};

export interface UserQuery {
  q?: string;
  roleId?: string;
  clientId?: string;
  scope?: "staff" | "client";
  status?: "active" | "invited" | "suspended";
}

export interface UserBody {
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  clientId?: string | null;
  language?: "es" | "en" | "pt" | null;
  receivesNotifications?: boolean;
}

export const usersApi = {
  list: (params: UserQuery) => api<{ items: AdminUserDto[] }>(`/users${query(params)}`).then((r) => r.items),
  roles: () => api<{ items: RoleOption[] }>("/users/roles").then((r) => r.items),
  get: (id: string) => api<AdminUserDetailDto>(`/users/${id}`),
  create: (body: UserBody & { password?: string; sendWelcome: boolean }) =>
    api<AccessResult & { user: AdminUserDetailDto }>("/users", json("POST", body)),
  update: (id: string, body: Partial<UserBody> & { status?: "active" | "suspended" }) =>
    api<AdminUserDetailDto>(`/users/${id}`, json("PATCH", body)),
  resetPassword: (id: string, sendEmail: boolean) =>
    api<AccessResult & { closedSessions: number }>(`/users/${id}/reset-password`, json("POST", { sendEmail })),
};

export const settingsApi = {
  publicSettings: () => api<PublicSettingsDto>("/settings/public"),
  get: () => api<SettingsDto>("/settings"),
  update: (body: Partial<InstanceSettingsValues>) => api<SettingsDto>("/settings", json("PATCH", body)),
  updateSender: (body: { name?: string; fromEmail?: string; replyTo?: string | null }) => api<SenderDto>("/settings/sender", json("PATCH", body)),
  updateRule: (id: string, body: { recipients?: RecipientKind[]; active?: boolean }) =>
    api<{ items: NotificationRuleDto[] }>(`/settings/rules/${id}`, json("PATCH", body)).then((r) => r.items),
  setWorkingDays: (workingDays: Weekday[]) => api<CalendarDto>("/settings/calendar/working-days", json("PUT", { workingDays })),
  addHoliday: (day: string, name: string) => api<CalendarDto>("/settings/calendar/holidays", json("POST", { day, name })),
  removeHoliday: (id: string) => api<CalendarDto>(`/settings/calendar/holidays/${id}`, { method: "DELETE" }),
};

export interface ReportQuery {
  days?: number;
  from?: string;
  to?: string;
  clientId?: string;
  typeId?: string;
}

export const reportsApi = {
  overview: (params: ReportQuery) => api<ReportDto>(`/reports/overview${query(params)}`),
};
