import type { WorkItemSummaryDto } from "../types/api";

const DETAIL_PATH: Record<string, string> = { support: "/tickets", task: "/tareas", implementation: "/implementaciones" };

export function detailPath(item: Pick<WorkItemSummaryDto, "id" | "type">): string {
  return `${DETAIL_PATH[item.type.code] ?? "/tickets"}/${item.id}`;
}
