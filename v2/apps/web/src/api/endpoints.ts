import { api } from "./client";
import type {
  ActivityDto,
  ClientDto,
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
};

export const stagesApi = {
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
  assignableUsers: () => api<{ items: UserOption[] }>("/users/assignable").then((r) => r.items),
  templates: (type: string) => api<{ items: TemplateDto[] }>(`/templates${query({ type })}`).then((r) => r.items),
  priorities: () => api<{ items: PriorityDto[] }>("/catalog/priorities").then((r) => r.items),
};
