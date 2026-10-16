import type { WorkItemSummaryDto } from "../types/api";

const DETAIL_PATH: Record<string, string> = { support: "/tickets", task: "/tareas", implementation: "/implementaciones" };

export function detailPath(item: Pick<WorkItemSummaryDto, "id" | "type">): string {
  return pathFor(item.type.code, item.id);
}

export function pathFor(typeCode: string, id: string): string {
  return `${DETAIL_PATH[typeCode] ?? "/tickets"}/${id}`;
}
