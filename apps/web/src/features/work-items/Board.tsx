import { useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { adminApi, catalogApi, workItemsApi } from "../../api/endpoints";
import { DueLabel } from "../../components/DueLabel";
import { ErrorNote, Loading } from "../../components/Feedback";
import { PriorityLabel, StatusBadge, useStatusLabel } from "../../components/StatusBadge";
import { useAction, useApi } from "../../hooks/useApi";
import type { BoardStatusDto, WorkItemSummaryDto } from "../../types/api";
import { todayDay, toDay } from "../../utils/dates";

export type BoardMode = "status" | "due" | "assignee" | "priority";
export const BOARD_MODES: BoardMode[] = ["status", "due", "assignee", "priority"];

const DONE = new Set(["resolved", "closed", "cancelled"]);
const DUE_BUCKETS = ["overdue", "today", "tomorrow", "thisWeek", "nextWeek", "later", "none"] as const;
type DueBucket = (typeof DUE_BUCKETS)[number];
const DUE_COLORS: Record<DueBucket, string> = {
  overdue: "var(--danger)",
  today: "var(--accent)",
  tomorrow: "var(--warn)",
  thisWeek: "var(--primary)",
  nextWeek: "var(--info, var(--primary))",
  later: "var(--muted)",
  none: "var(--border)",
};

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Límites de la semana (lunes a domingo) para las columnas por vencimiento. */
function dueRanges(today: string) {
  const weekday = (new Date(`${today}T12:00:00`).getDay() + 6) % 7; // 0 = lunes
  const sunday = addDays(today, 6 - weekday);
  const nextMonday = addDays(sunday, 1);
  return { tomorrow: addDays(today, 1), sunday, nextMonday, nextSunday: addDays(nextMonday, 6) };
}

function bucketOf(item: WorkItemSummaryDto, today: string): DueBucket {
  if (!item.dueAt) return "none";
  const day = toDay(item.dueAt);
  const r = dueRanges(today);
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day === r.tomorrow) return "tomorrow";
  if (day <= r.sunday) return "thisWeek";
  if (day <= r.nextSunday) return "nextWeek";
  return "later";
}

/** Fecha que se pone al soltar una tarjeta en una columna de vencimiento. */
function dayFor(bucket: DueBucket, today: string): string | null | undefined {
  const r = dueRanges(today);
  switch (bucket) {
    case "today":
      return today;
    case "tomorrow":
      return r.tomorrow;
    case "thisWeek": {
      const friday = addDays(r.sunday, -2);
      const candidate = friday > r.tomorrow ? friday : addDays(today, 2);
      return candidate <= r.sunday ? candidate : r.sunday;
    }
    case "nextWeek":
      return r.nextMonday;
    case "later":
      return addDays(r.nextMonday, 7);
    case "none":
      return null;
    default:
      return undefined;
  }
}

interface Column {
  key: string;
  title: string;
  color: string;
  hint?: string;
  items: WorkItemSummaryDto[];
  accepts: (item: WorkItemSummaryDto) => boolean;
  move: (item: WorkItemSummaryDto) => Promise<unknown>;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function Card({
  item,
  basePath,
  targets,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  item: WorkItemSummaryDto;
  basePath: string;
  targets: Column[];
  onMove: (column: Column) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <article
      className="board-card"
      draggable={targets.length > 0}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="board-card-top">
        <span className="number">{item.number}</span>
        <PriorityLabel priority={item.priority} />
      </div>
      <Link to={`${basePath}/${item.id}`} className="board-card-title">
        {item.title}
      </Link>
      {item.client && <span className="muted small">{item.client.name}</span>}
      <div className="board-card-foot">
        <StatusBadge status={item.status} />
        {item.dueAt && <DueLabel date={item.dueAt} done={DONE.has(item.status.category)} />}
        <span className={`avatar sm${item.assignee ? "" : " empty"}`} title={item.assignee?.name ?? t("work.unassigned")}>
          {item.assignee ? initials(item.assignee.name) : "—"}
        </span>
      </div>
      {targets.length > 0 && (
        <select
          className="board-move"
          value=""
          aria-label={t("board.moveTo", { item: item.number })}
          onChange={(e) => {
            const column = targets.find((c) => c.key === e.target.value);
            if (column) onMove(column);
          }}
        >
          <option value="">{t("board.moveTo", { item: "" })}</option>
          {targets.map((c) => (
            <option key={c.key} value={c.key}>
              {c.title}
            </option>
          ))}
        </select>
      )}
    </article>
  );
}

/** Tablero de tickets o tareas: columnas por estado, vencimiento, técnico o prioridad. Arrastrar una tarjeta la cambia. */
export function Board({ type, basePath, mode, q, mine }: { type: string; basePath: string; mode: BoardMode; q: string; mine: boolean }) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel();
  const today = todayDay();
  const assignee = mine ? "me" : undefined;
  const open = useApi(() => workItemsApi.list({ type, view: "open", q, assignee, perPage: 100, sort: "due_at" }), [type, q, mine]);
  const done = useApi(
    () => (mode === "status" ? workItemsApi.list({ type, view: "done", q, assignee, perPage: 20, sort: "-updated" }) : Promise.resolve(null)),
    [type, q, mine, mode],
  );
  const board = useApi(() => (mode === "status" ? catalogApi.board(type) : Promise.resolve(null)), [type, mode]);
  const priorities = useApi(() => (mode === "priority" ? adminApi.priorities() : Promise.resolve([])), [mode]);
  const people = useApi(() => (mode === "assignee" ? adminApi.assignableUsers() : Promise.resolve([])), [mode]);
  const action = useAction();
  const [dragging, setDragging] = useState<WorkItemSummaryDto | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<{ item: WorkItemSummaryDto; status: BoardStatusDto } | null>(null);
  const [comment, setComment] = useState("");

  const items = [...(open.data?.items ?? []), ...(done.data?.items ?? [])];
  const reload = () => {
    open.reload();
    done.reload();
  };

  const columns: Column[] = (() => {
    switch (mode) {
      case "status": {
        const statuses = board.data?.statuses ?? [];
        return statuses.map((s) => ({
          key: s.id,
          title: statusLabel(s),
          color: s.color || "var(--border)",
          hint: s.isFinal ? t("board.recentDone") : undefined,
          items: items.filter((i) => i.status.id === s.id),
          accepts: (i) => !!statuses.find((x) => x.id === i.status.id)?.next.some((n) => n.statusId === s.id),
          move: async (i) => {
            const rule = statuses.find((x) => x.id === i.status.id)?.next.find((n) => n.statusId === s.id);
            if (rule?.requiresComment) {
              setCommentFor({ item: i, status: s });
              return null;
            }
            return workItemsApi.transition(i.id, s.id);
          },
        }));
      }
      case "due":
        return DUE_BUCKETS.map((b) => ({
          key: b,
          title: t(`board.due.${b}`),
          color: DUE_COLORS[b],
          items: items.filter((i) => bucketOf(i, today) === b),
          accepts: (i) => b !== "overdue" && bucketOf(i, today) !== b,
          move: (i) => workItemsApi.update(i.id, { dueAt: dayFor(b, today) ?? null }),
        }));
      case "assignee": {
        const list = people.data ?? [];
        const known = new Set(list.map((p) => p.id));
        const extra = items.filter((i) => i.assignee && !known.has(i.assignee.id)).map((i) => ({ id: i.assignee!.id, name: i.assignee!.name }));
        const cols = [{ id: "", name: t("work.unassigned") }, ...list, ...extra.filter((p, idx) => extra.findIndex((x) => x.id === p.id) === idx)];
        return cols.map((p) => ({
          key: p.id || "none",
          title: p.name,
          color: p.id ? "var(--primary)" : "var(--border)",
          hint: p.id ? t("board.load", { count: items.filter((i) => i.assignee?.id === p.id).length }) : undefined,
          items: items.filter((i) => (i.assignee?.id ?? "") === p.id),
          accepts: (i) => (i.assignee?.id ?? "") !== p.id,
          move: (i) => workItemsApi.update(i.id, { assigneeId: p.id || null }),
        }));
      }
      case "priority":
        return (priorities.data ?? []).map((p) => ({
          key: p.id,
          title: t(p.labelKey, { defaultValue: p.name }),
          color: p.color,
          items: items.filter((i) => i.priority?.id === p.id),
          accepts: (i) => i.priority?.id !== p.id,
          move: (i) => workItemsApi.update(i.id, { priorityId: p.id }),
        }));
    }
  })();

  const move = async (item: WorkItemSummaryDto, column: Column) => {
    if (!column.accepts(item)) return;
    const res = await action.run(() => column.move(item));
    if (res) reload();
  };

  const drop = (e: DragEvent, column: Column) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const item = items.find((i) => i.id === id);
    if (item) void move(item, column);
  };

  const loading = open.loading || (mode === "status" && board.loading) || priorities.loading || people.loading;
  const error = open.error ?? board.error ?? priorities.error ?? people.error;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (loading && !open.data) return <Loading />;

  return (
    <>
      {action.error && <p className="form-error">{action.error}</p>}
      {open.data && open.data.totalItems > open.data.items.length && (
        <p className="hint">{t("board.truncated", { shown: open.data.items.length, total: open.data.totalItems })}</p>
      )}
      <div className={`board${action.busy ? " busy" : ""}`}>
        {columns.map((column) => {
          const droppable = !!dragging && column.accepts(dragging);
          return (
            <section
              key={column.key}
              className={`board-col${droppable ? " droppable" : ""}${over === column.key && droppable ? " over" : ""}`}
              style={{ borderTopColor: column.color }}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(column.key);
              }}
              onDragLeave={() => setOver((o) => (o === column.key ? null : o))}
              onDrop={(e) => drop(e, column)}
              aria-label={column.title}
            >
              <header className="board-col-head">
                <span>{column.title}</span>
                <span className="count">{column.items.length}</span>
              </header>
              {column.hint && <p className="muted small board-col-hint">{column.hint}</p>}
              <div className="board-col-body">
                {column.items.map((item) => (
                  <Card
                    key={item.id}
                    item={item}
                    basePath={basePath}
                    targets={columns.filter((c) => c.key !== column.key && c.accepts(item))}
                    onMove={(c) => void move(item, c)}
                    onDragStart={() => setDragging(item)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  />
                ))}
                {column.items.length === 0 && <p className="muted small board-empty">{droppable ? t("board.dropHere") : t("board.empty")}</p>}
              </div>
            </section>
          );
        })}
      </div>

      {commentFor && (
        <div className="modal-backdrop" role="presentation" onClick={() => setCommentFor(null)}>
          <form
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-comment-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await action.run(() => workItemsApi.transition(commentFor.item.id, commentFor.status.id, comment.trim()));
              if (res) {
                setCommentFor(null);
                setComment("");
                reload();
              }
            }}
          >
            <h2 id="board-comment-title" className="card-title">
              {t("board.commentTitle", { item: commentFor.item.number, status: statusLabel(commentFor.status) })}
            </h2>
            <label className="field">
              {t("board.commentLabel")}
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} required autoFocus />
            </label>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary-sm" disabled={action.busy || !comment.trim()}>
                {t("common.save")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCommentFor(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
