import type { RecordModel } from "pocketbase";
import { anyOf, ensureAdminAuth, pb, pbDate } from "../db/pocketbase.js";
import type { ClientRequestRow, StageRow, StatusCategory } from "../types/records.js";

export interface ReportItemRow extends RecordModel {
  number: string;
  title: string;
  type: string;
  status_category: StatusCategory;
  client: string;
  assignee: string;
  requester: string;
  created: string;
  resolved_at: string;
  closed_at: string;
  first_response_at: string;
  due_at: string;
  progress_percent: number;
}

export type ReportRequestRow = Pick<ClientRequestRow, "id" | "work_item" | "status" | "due_at" | "submitted_at" | "created" | "blocking"> & {
  expand?: { work_item?: { client: string; deleted_at: string } };
};

export type ReportStageRow = Pick<StageRow, "id" | "work_item" | "responsible_side" | "planned_end" | "completed_at" | "completed_by" | "started_at">;

const OPEN = "status_category != 'resolved' && status_category != 'closed' && status_category != 'cancelled'";

export interface ReportScope {
  from: Date;
  to: Date;
  clientId?: string;
  typeId?: string;
}

function scopeFilter(s: ReportScope, prefix = ""): string {
  const parts = [`${prefix}deleted_at = ''`];
  if (s.clientId) parts.push(pb.filter(`${prefix}client = {:c}`, { c: s.clientId }));
  if (s.typeId) parts.push(pb.filter(`${prefix}type = {:t}`, { t: s.typeId }));
  return parts.join(" && ");
}

export const reportsModel = {
  /** Casos abiertos hoy, creados en el período o resueltos en el período. */
  async workItems(s: ReportScope): Promise<ReportItemRow[]> {
    await ensureAdminAuth();
    const range = pb.filter("({:from} <= created && created <= {:to}) || ({:from} <= resolved_at && resolved_at <= {:to})", {
      from: pbDate(s.from),
      to: pbDate(s.to),
    });
    return pb.collection("work_items").getFullList<ReportItemRow>({
      filter: `${scopeFilter(s)} && ((${OPEN}) || ${range})`,
      fields: "id,number,title,type,status_category,client,assignee,requester,created,resolved_at,closed_at,first_response_at,due_at,progress_percent",
      sort: "created",
    });
  },

  async stages(workItemIds: string[]): Promise<ReportStageRow[]> {
    if (!workItemIds.length) return [];
    await ensureAdminAuth();
    const out: ReportStageRow[] = [];
    for (let i = 0; i < workItemIds.length; i += 50) {
      out.push(
        ...(await pb.collection("stages").getFullList<ReportStageRow & RecordModel>({
          filter: anyOf("work_item", workItemIds.slice(i, i + 50)),
          fields: "id,work_item,responsible_side,planned_end,completed_at,completed_by,started_at",
        })),
      );
    }
    return out;
  },

  /** Requerimientos abiertos o creados en el período. */
  async clientRequests(s: ReportScope): Promise<ReportRequestRow[]> {
    await ensureAdminAuth();
    const open = "(status = 'pending' || status = 'rejected' || status = 'submitted' || status = 'in_review')";
    const range = pb.filter("({:from} <= created && created <= {:to})", { from: pbDate(s.from), to: pbDate(s.to) });
    return pb.collection("client_requests").getFullList<ReportRequestRow & RecordModel>({
      filter: `${scopeFilter(s, "work_item.")} && status != 'cancelled' && (${open} || ${range})`,
      expand: "work_item",
      fields: "id,work_item,status,due_at,submitted_at,created,blocking,expand.work_item.client,expand.work_item.deleted_at",
    });
  },

  /** Cuántas veces se devolvió cada requerimiento (eventos client_request.rejected del período). */
  async rejectionsByClient(s: ReportScope): Promise<Map<string, number>> {
    await ensureAdminAuth();
    const rows = await pb.collection("work_item_events").getFullList<RecordModel & { expand?: { work_item?: { client: string } } }>({
      filter: `event_type.code = 'client_request.rejected' && ${scopeFilter(s, "work_item.")} && ${pb.filter("{:from} <= created && created <= {:to}", { from: pbDate(s.from), to: pbDate(s.to) })}`,
      expand: "work_item",
      fields: "id,expand.work_item.client",
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      const client = r.expand?.work_item?.client ?? "";
      counts.set(client, (counts.get(client) ?? 0) + 1);
    }
    return counts;
  },

  async names(collection: "users" | "clients", ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    await ensureAdminAuth();
    const out = new Map<string, string>();
    for (let i = 0; i < unique.length; i += 50) {
      const rows = await pb.collection(collection).getFullList<RecordModel & { name: string; email?: string }>({
        filter: anyOf("id", unique.slice(i, i + 50)),
        fields: collection === "users" ? "id,name,email" : "id,name",
      });
      for (const r of rows) out.set(r.id, r.name || r.email || r.id);
    }
    return out;
  },

  async clientUserIds(ids: string[]): Promise<Set<string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const out = new Set<string>();
    if (!unique.length) return out;
    await ensureAdminAuth();
    for (let i = 0; i < unique.length; i += 50) {
      const rows = await pb.collection("users").getFullList<RecordModel>({
        filter: `(${anyOf("id", unique.slice(i, i + 50))}) && client != ''`,
        fields: "id",
      });
      for (const r of rows) out.add(r.id);
    }
    return out;
  },
};
