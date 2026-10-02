export type StageStatus = "pending" | "in_progress" | "waiting_client" | "completed";
export type ResponsibleSide = "internal" | "client" | "shared";
export type ChecklistStatus = "done" | "in_progress" | "pending";
export type ClientRequestStatus = "pending" | "submitted" | "in_review" | "accepted" | "rejected";

export interface ChecklistItem {
  title: string;
  status: ChecklistStatus;
}

export interface Stage {
  id: string;
  order: number;
  name: string;
  status: StageStatus;
  side: ResponsibleSide;
  /** null = sin duración fija (continuo). */
  estimateDays: number | null;
  summary?: string;
  checklist: ChecklistItem[];
}

export interface ClientRequest {
  id: string;
  stageId: string;
  title: string;
  status: ClientRequestStatus;
  blocking: boolean;
  dueDate: string;
}

export interface LogEntry {
  date: string;
  text: string;
}

export interface Implementation {
  id: string;
  number: string;
  title: string;
  client: string;
  dueDate: string;
  stages: Stage[];
  requests: ClientRequest[];
  log: LogEntry[];
}
