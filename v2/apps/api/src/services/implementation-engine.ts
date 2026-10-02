import { pbDate } from "../db/pocketbase.js";
import { clientRequestsModel } from "../models/client-requests.model.js";
import { stagesModel } from "../models/stages.model.js";
import type { WriteOp } from "../models/unit-of-work.model.js";
import type {
  ClientRequestRow,
  StageDependencyRow,
  StageRow,
  StatusCategory,
  StatusRow,
  WorkItemRow,
  WorkItemTypeRow,
} from "../types/records.js";
import { Errors } from "../utils/errors.js";
import type { Catalog } from "./catalog-cache.service.js";
import type { DomainEvent } from "./events.js";
import { statusByCategory } from "./workflow.js";

const FINAL: StatusCategory[] = ["closed", "resolved", "cancelled"];
const SETTLED_REQUEST = ["accepted", "cancelled"];

export interface ImplementationState {
  item: WorkItemRow;
  type: WorkItemTypeRow;
  stages: StageRow[];
  dependencies: StageDependencyRow[];
  requests: ClientRequestRow[];
}

export async function loadImplementationState(item: WorkItemRow, type: WorkItemTypeRow): Promise<ImplementationState> {
  const [stages, dependencies, requests] = await Promise.all([
    stagesModel.listByWorkItem(item.id),
    stagesModel.dependencies(item.id),
    clientRequestsModel.listByWorkItem(item.id),
  ]);
  return { item, type, stages, dependencies, requests };
}

/**
 * Reglas de una implementación: arranque y cierre de etapas, desbloqueo de las siguientes,
 * espera del cliente por requerimientos obligatorios y estado del caso según sus etapas.
 * Acumula operaciones y eventos sobre el estado en memoria; el service los guarda en un batch.
 */
export class ImplementationPlan {
  readonly ops: WriteOp[] = [];
  readonly events: DomainEvent[] = [];
  private readonly now = pbDate(new Date());

  constructor(
    private readonly catalog: Catalog,
    readonly state: ImplementationState,
    private readonly actorId: string | null,
  ) {}

  category(stage: StageRow): StatusCategory | undefined {
    return this.catalog.statusById.get(stage.status)?.category;
  }

  isFinal(stage: StageRow): boolean {
    const category = this.category(stage);
    return !!category && FINAL.includes(category);
  }

  private stageStatus(category: StatusCategory): StatusRow {
    const status = statusByCategory(this.catalog, this.state.type.stage_workflow, category);
    if (!status) throw Errors.configuration(`stage workflow without ${category} status`);
    return status;
  }

  private event(code: string, data: Record<string, unknown>) {
    this.events.push({ code, workItemId: this.state.item.id, actorId: this.actorId, data });
  }

  setStageStatus(stage: StageRow, status: StatusRow, extra: Record<string, unknown> = {}) {
    stage.status = status.id;
    this.ops.push({ op: "update", collection: "stages", id: stage.id, data: { status: status.id, ...extra } });
  }

  dependenciesDone(stage: StageRow): boolean {
    return this.state.dependencies
      .filter((d) => d.stage === stage.id)
      .every((d) => {
        const dep = this.state.stages.find((s) => s.id === d.depends_on);
        return !dep || this.isFinal(dep);
      });
  }

  openBlockingRequests(stage: StageRow): ClientRequestRow[] {
    return this.state.requests.filter((r) => r.stage === stage.id && r.blocking && !SETTLED_REQUEST.includes(r.status));
  }

  /** Inicia una etapa; si tiene requerimientos obligatorios sin aceptar, queda esperando al cliente. */
  startStage(stage: StageRow) {
    const waiting = this.openBlockingRequests(stage).length > 0;
    const target = this.stageStatus(waiting ? "waiting_client" : "in_progress");
    this.setStageStatus(stage, target, stage.started_at ? {} : { started_at: this.now });
    this.event("stage.started", { stageId: stage.id, stage: stage.name });
    for (const request of this.state.requests.filter((r) => r.stage === stage.id && r.status === "pending")) {
      this.event("client_request.created", { requestId: request.id, request: request.title, stageId: stage.id });
    }
  }

  completeStage(stage: StageRow, status: StatusRow) {
    this.setStageStatus(stage, status, { completed_at: this.now, completed_by: this.actorId ?? "" });
    this.event("stage.completed", { stageId: stage.id, stage: stage.name });
    this.unlockDependents();
  }

  /** Arranca las etapas pendientes cuyas dependencias ya terminaron. */
  unlockDependents() {
    for (const stage of [...this.state.stages].sort((a, b) => a.sort_order - b.sort_order)) {
      const hasDependencies = this.state.dependencies.some((d) => d.stage === stage.id);
      if (this.category(stage) !== "new" || !hasDependencies || !this.dependenciesDone(stage)) continue;
      this.startStage(stage);
      this.event("stage.unlocked", { stageId: stage.id, stage: stage.name });
    }
  }

  /** Al iniciar la implementación arrancan las etapas que no dependen de otras. */
  startRootStages() {
    for (const stage of [...this.state.stages].sort((a, b) => a.sort_order - b.sort_order)) {
      const hasDependencies = this.state.dependencies.some((d) => d.stage === stage.id);
      if (this.category(stage) === "new" && !hasDependencies) this.startStage(stage);
    }
  }

  /** Pasa una etapa entre "en curso" y "esperando cliente" según sus requerimientos obligatorios. */
  refreshWaiting(stage: StageRow) {
    const waitingStatus = this.stageStatus("waiting_client");
    const open = this.openBlockingRequests(stage).length > 0;
    if (stage.status === waitingStatus.id && !open) this.setStageStatus(stage, this.stageStatus("in_progress"));
    else if (this.category(stage) === "in_progress" && open) this.setStageStatus(stage, waitingStatus);
  }

  /**
   * Estado del caso según sus etapas: todas cerradas → completada; alguna esperando al cliente →
   * esperando cliente; alguna iniciada → en curso. No toca una implementación en pausa, cancelada o cerrada.
   */
  syncItemStatus() {
    const item = this.state.item;
    const current = this.catalog.statusById.get(item.status);
    if (!current || ["waiting_internal", "cancelled", "closed", "resolved"].includes(current.category)) return;

    const active = this.state.stages.filter((s) => this.category(s) !== "cancelled");
    let target: StatusCategory | null = null;
    if (active.length && active.every((s) => this.isFinal(s))) target = "closed";
    else if (active.some((s) => this.category(s) === "waiting_client")) target = "waiting_client";
    else if (active.some((s) => this.category(s) !== "new")) target = "in_progress";
    if (!target || target === current.category) return;

    const status = statusByCategory(this.catalog, this.state.type.workflow, target);
    if (!status) return;
    item.status = status.id;
    this.ops.push({
      op: "update",
      collection: "work_items",
      id: item.id,
      data: { status: status.id, updated_by: this.actorId ?? "" },
    });
    this.event("work_item.status_changed", { from: current.code, to: status.code, automatic: true });
    if (target === "closed") this.event("implementation.completed", {});
  }
}
