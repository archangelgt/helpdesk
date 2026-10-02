import { useState } from "react";
import type { ChecklistItemDto } from "../types/api";

/** Lista de tareas; quien puede editar marca o desmarca cada punto. */
export function Checklist({
  items,
  editable,
  onToggle,
}: {
  items: ChecklistItemDto[];
  editable: boolean;
  onToggle: (id: string, done: boolean) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (id: string, done: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await onToggle(id, done);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ul className="tasks">
        {items.map((item) => (
          <li key={item.id} className={item.isDone ? "done" : "pending"}>
            {editable ? (
              <input
                type="checkbox"
                className="task-check"
                checked={item.isDone}
                disabled={busy === item.id}
                aria-label={item.title}
                onChange={(e) => void toggle(item.id, e.target.checked)}
              />
            ) : (
              <span className={`dot ${item.isDone ? "done" : "pending"}`} aria-hidden="true" />
            )}
            <span className="task-title">{item.title}</span>
          </li>
        ))}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
