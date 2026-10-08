import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { adminApi, reportsApi, type ReportQuery } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthProvider";
import { ErrorNote, Loading, NoAccess } from "../../components/Feedback";
import { ProgressBar } from "../../components/Progress";
import { useApi } from "../../hooks/useApi";
import type { ReportDto } from "../../types/api";
import { formatDate, todayDay } from "../../utils/dates";

const PERIODS = [7, 30, 90, 365] as const;

type Cell = string | number | null;

/** CSV con separador «;» y BOM para que Excel en español lo abra con acentos y columnas correctas. */
function downloadCsv(name: string, headers: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    const text = v === null ? "" : String(v);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${todayDay()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function hours(value: number | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (value === null) return "—";
  if (value < 1) return t("reports.minutes", { n: Math.max(1, Math.round(value * 60)) });
  if (value < 48) return t("reports.hours", { n: Math.round(value * 10) / 10 });
  return t("reports.days", { n: Math.round((value / 24) * 10) / 10 });
}

function Section({ title, onExport, children, hint }: { title: string; onExport?: () => void; children: ReactNode; hint?: string }) {
  const { t } = useTranslation();
  return (
    <section className="card report-section">
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {hint && <p className="hint report-hint">{hint}</p>}
        </div>
        {onExport && (
          <button type="button" className="btn btn-ghost" onClick={onExport}>
            <Download size={14} aria-hidden="true" /> {t("reports.export")}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Barra horizontal proporcional al máximo de la columna. */
function Bar({ value, max, tone = "" }: { value: number; max: number; tone?: string }) {
  return (
    <span className="cell-bar">
      <i className={tone} style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
      <b>{value}</b>
    </span>
  );
}

function TrendChart({ data }: { data: ReportDto["trend"] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.resolved)));
  const W = 720;
  const H = 180;
  const pad = 24;
  const slot = (W - pad) / Math.max(1, data.length);
  const bar = Math.max(2, Math.min(14, slot / 2 - 2));
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label={t("reports.trend")}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad} x2={W} y1={H - f * (H - 10)} y2={H - f * (H - 10)} className="grid-line" />
            <text x={0} y={H - f * (H - 10) + 4} className="axis">
              {Math.round(f * max)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad + i * slot + slot / 2;
          const hc = (d.created / max) * (H - 10);
          const hr = (d.resolved / max) * (H - 10);
          return (
            <g key={d.date}>
              <title>{`${formatDate(d.date, lang)}: ${t("reports.created")} ${d.created} · ${t("reports.resolved")} ${d.resolved}`}</title>
              <rect x={x - bar - 1} y={H - hc} width={bar} height={hc} className="bar-created" rx={2} />
              <rect x={x + 1} y={H - hr} width={bar} height={hr} className="bar-resolved" rx={2} />
              {i % labelEvery === 0 && (
                <text x={x} y={H + 16} textAnchor="middle" className="axis">
                  {new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(new Date(`${d.date}T12:00:00`))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span>
          <i className="bar-created" /> {t("reports.created")}
        </span>
        <span>
          <i className="bar-resolved" /> {t("reports.resolved")}
        </span>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "es";
  const { can } = useAuth();
  const allowed = can("report.view");
  const [days, setDays] = useState<number | "custom">(30);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayDay());
  const [clientId, setClientId] = useState("");
  const [typeId, setTypeId] = useState("");
  const query: ReportQuery = {
    ...(days === "custom" ? { from: from || undefined, to: to || undefined } : { days }),
    clientId: clientId || undefined,
    typeId: typeId || undefined,
  };
  const report = useApi(() => (allowed ? reportsApi.overview(query) : Promise.resolve(undefined)), [allowed, JSON.stringify(query)]);
  const clients = useApi(() => (allowed ? adminApi.clients() : Promise.resolve([])), [allowed]);
  const [types, setTypes] = useState<ReportDto["byType"]>([]);
  useEffect(() => {
    if (report.data?.byType.length) setTypes((prev) => (prev.length ? prev : report.data!.byType));
  }, [report.data]);

  if (!allowed) return <NoAccess section="reports" />;
  const r = report.data;

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{t("nav.reports")}</h1>
        <p className="muted">{t("reports.lead")}</p>
      </header>

      <div className="toolbar report-filters">
        <div className="tabs" role="tablist">
          {PERIODS.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={days === p} className={days === p ? "on" : ""} onClick={() => setDays(p)}>
              {t("reports.lastDays", { n: p })}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={days === "custom"} className={days === "custom" ? "on" : ""} onClick={() => setDays("custom")}>
            {t("reports.custom")}
          </button>
        </div>
        {days === "custom" && (
          <>
            <input type="date" className="filter-select" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label={t("reports.from")} />
            <input type="date" className="filter-select" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label={t("reports.to")} />
          </>
        )}
        <select className="filter-select" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label={t("reports.client")}>
          <option value="">{t("reports.allClients")}</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="filter-select" value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label={t("reports.type")}>
          <option value="">{t("reports.allTypes")}</option>
          {types.map((ty) => (
            <option key={ty.typeId} value={ty.typeId}>
              {t(`types.${ty.code}`, { defaultValue: ty.name })}
            </option>
          ))}
        </select>
      </div>

      {report.error && <ErrorNote error={report.error} onRetry={report.reload} />}
      {!r && !report.error && <Loading />}
      {r && (
        <>
          <p className="muted small">
            {t("reports.period", { from: formatDate(r.period.from, lang), to: formatDate(r.period.to, lang) })}
            {report.loading && ` · ${t("common.loading")}`}
          </p>
          <div className="counters">
            {(
              [
                ["created", r.summary.created],
                ["resolved", r.summary.resolved],
                ["open", r.summary.open],
                ["overdue", r.summary.overdue],
                ["unassigned", r.summary.unassigned],
                ["waitingClient", r.summary.waitingClient],
                ["avgFirstResponse", hours(r.summary.avgFirstResponseHours, t)],
                ["avgResolution", hours(r.summary.avgResolutionHours, t)],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className={`card counter ${key}`}>
                <span className="counter-value">{value}</span>
                <span className="counter-label">{t(`reports.summary.${key}`)}</span>
              </div>
            ))}
          </div>

          <Section title={t("reports.trend")}>
            <TrendChart data={r.trend} />
          </Section>

          <div className="report-grid">
            <Section
              title={t("reports.byType")}
              onExport={() =>
                downloadCsv(
                  "reporte-por-tipo",
                  [t("reports.type"), t("reports.created"), t("reports.resolved"), t("reports.open"), t("reports.overdue"), t("reports.avgResolution")],
                  r.byType.map((x) => [t(`types.${x.code}`, { defaultValue: x.name }), x.created, x.resolved, x.open, x.overdue, x.avgResolutionHours]),
                )
              }
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("reports.type")}</th>
                    <th className="num">{t("reports.created")}</th>
                    <th className="num">{t("reports.resolved")}</th>
                    <th className="num">{t("reports.open")}</th>
                    <th className="num">{t("reports.overdue")}</th>
                    <th className="num">{t("reports.avgResolution")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byType.map((x) => (
                    <tr key={x.typeId}>
                      <td>{t(`types.${x.code}`, { defaultValue: x.name })}</td>
                      <td className="num">{x.created}</td>
                      <td className="num">{x.resolved}</td>
                      <td className="num">{x.open}</td>
                      <td className={`num ${x.overdue ? "danger-text" : ""}`}>{x.overdue}</td>
                      <td className="num nowrap">{hours(x.avgResolutionHours, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section
              title={t("reports.byAssignee")}
              hint={r.unassignedOpen ? t("reports.unassignedNote", { n: r.unassignedOpen }) : undefined}
              onExport={() =>
                downloadCsv(
                  "reporte-por-tecnico",
                  [t("reports.assignee"), t("reports.resolved"), t("reports.open"), t("reports.overdue"), t("reports.avgResolution"), t("reports.stagesCompleted")],
                  r.byAssignee.map((x) => [x.name, x.resolved, x.open, x.overdue, x.avgResolutionHours, x.stagesCompleted]),
                )
              }
            >
              {r.byAssignee.length === 0 ? (
                <p className="muted empty">{t("reports.noData")}</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.assignee")}</th>
                      <th>{t("reports.resolved")}</th>
                      <th className="num">{t("reports.open")}</th>
                      <th className="num">{t("reports.overdue")}</th>
                      <th className="num">{t("reports.avgResolution")}</th>
                      <th className="num">{t("reports.stagesCompleted")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byAssignee.map((x) => (
                      <tr key={x.userId}>
                        <td>{x.name}</td>
                        <td>
                          <Bar value={x.resolved} max={Math.max(...r.byAssignee.map((a) => a.resolved))} tone="ok" />
                        </td>
                        <td className="num">{x.open}</td>
                        <td className={`num ${x.overdue ? "danger-text" : ""}`}>{x.overdue}</td>
                        <td className="num nowrap">{hours(x.avgResolutionHours, t)}</td>
                        <td className="num">{x.stagesCompleted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section
              title={t("reports.byClient")}
              onExport={() =>
                downloadCsv(
                  "reporte-por-empresa",
                  [t("reports.client"), t("reports.created"), t("reports.resolved"), t("reports.open"), t("reports.overdue")],
                  r.byClient.map((x) => [x.name, x.created, x.resolved, x.open, x.overdue]),
                )
              }
            >
              {r.byClient.length === 0 ? (
                <p className="muted empty">{t("reports.noData")}</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.client")}</th>
                      <th>{t("reports.created")}</th>
                      <th className="num">{t("reports.resolved")}</th>
                      <th className="num">{t("reports.open")}</th>
                      <th className="num">{t("reports.overdue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byClient.map((x) => (
                      <tr key={x.clientId}>
                        <td>{x.name}</td>
                        <td>
                          <Bar value={x.created} max={Math.max(...r.byClient.map((c) => c.created))} />
                        </td>
                        <td className="num">{x.resolved}</td>
                        <td className="num">{x.open}</td>
                        <td className={`num ${x.overdue ? "danger-text" : ""}`}>{x.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section
              title={t("reports.byRequester")}
              onExport={() =>
                downloadCsv(
                  "reporte-por-solicitante",
                  [t("reports.requester"), t("reports.client"), t("reports.created")],
                  r.byRequester.map((x) => [x.name, x.clientName, x.created]),
                )
              }
            >
              {r.byRequester.length === 0 ? (
                <p className="muted empty">{t("reports.noData")}</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.requester")}</th>
                      <th>{t("reports.client")}</th>
                      <th>{t("reports.created")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byRequester.map((x) => (
                      <tr key={x.userId}>
                        <td>{x.name}</td>
                        <td className="muted small">{x.clientName ?? t("users.internal")}</td>
                        <td>
                          <Bar value={x.created} max={r.byRequester[0]?.created ?? 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          <Section
            title={t("reports.implementations")}
            hint={t("reports.delayHint")}
            onExport={() =>
              downloadCsv(
                "reporte-implementaciones",
                [
                  t("reports.number"),
                  t("reports.titleCol"),
                  t("reports.client"),
                  t("reports.assignee"),
                  t("reports.progress"),
                  t("reports.stages"),
                  t("reports.delayedStages"),
                  t("reports.clientDelay"),
                  t("reports.internalDelay"),
                  t("reports.pendingRequests"),
                  t("reports.overdueRequests"),
                  t("reports.dueAt"),
                ],
                r.implementations.items.map((x) => [
                  x.number,
                  x.title,
                  x.clientName,
                  x.assigneeName,
                  x.progress,
                  `${x.stagesDone}/${x.stagesTotal}`,
                  x.delayedStages,
                  x.clientDelayDays,
                  x.internalDelayDays,
                  x.pendingRequests,
                  x.overdueRequests,
                  x.dueAt ? x.dueAt.slice(0, 10) : null,
                ]),
              )
            }
          >
            <div className="counters small-counters">
              {(
                [
                  ["active", r.implementations.totals.active],
                  ["delayed", r.implementations.totals.delayed],
                  ["avgProgress", r.implementations.totals.avgProgress === null ? "—" : `${Math.round(r.implementations.totals.avgProgress)} %`],
                  ["clientDelay", t("reports.daysShort", { n: r.implementations.totals.clientDelayDays })],
                  ["internalDelay", t("reports.daysShort", { n: r.implementations.totals.internalDelayDays })],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className={`counter impl-${key}`}>
                  <span className="counter-value">{value}</span>
                  <span className="counter-label">{t(`reports.implTotals.${key}`)}</span>
                </div>
              ))}
            </div>
            {r.implementations.items.length === 0 ? (
              <p className="muted empty">{t("reports.noImplementations")}</p>
            ) : (
              <div className="table-card">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.implementation")}</th>
                      <th>{t("reports.progress")}</th>
                      <th className="num">{t("reports.stages")}</th>
                      <th className="num">{t("reports.clientDelay")}</th>
                      <th className="num">{t("reports.internalDelay")}</th>
                      <th className="num">{t("reports.requestsCol")}</th>
                      <th>{t("reports.dueAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.implementations.items.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <Link className="row-link" to={`/implementaciones/${x.id}`}>
                            {x.number} · {x.title}
                          </Link>
                          <span className="muted small block">
                            {[x.clientName, x.assigneeName].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </td>
                        <td className="progress-cell">
                          <ProgressBar value={x.progress} />
                          <span className="small">{x.progress} %</span>
                        </td>
                        <td className="num nowrap">
                          {x.stagesDone}/{x.stagesTotal}
                          {x.delayedStages > 0 && <span className="danger-text small block">{t("reports.delayedN", { n: x.delayedStages })}</span>}
                        </td>
                        <td className={`num ${x.clientDelayDays ? "client-text" : ""}`}>{x.clientDelayDays}</td>
                        <td className={`num ${x.internalDelayDays ? "danger-text" : ""}`}>{x.internalDelayDays}</td>
                        <td className="num nowrap">
                          {x.pendingRequests}
                          {x.overdueRequests > 0 && <span className="danger-text small block">{t("reports.overdueN", { n: x.overdueRequests })}</span>}
                        </td>
                        <td className="small nowrap">{x.dueAt ? formatDate(x.dueAt, lang) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            title={t("reports.clientRequests")}
            onExport={() =>
              downloadCsv(
                "reporte-requerimientos",
                [t("reports.client"), t("reports.pending"), t("reports.overdue"), t("reports.inReview"), t("reports.avgDelivery"), t("reports.rejected")],
                r.clientRequests.map((x) => [x.name, x.pending, x.overdue, x.inReview, x.avgDeliveryDays, x.rejected]),
              )
            }
          >
            {r.clientRequests.length === 0 ? (
              <p className="muted empty">{t("reports.noData")}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("reports.client")}</th>
                    <th className="num">{t("reports.pending")}</th>
                    <th className="num">{t("reports.overdue")}</th>
                    <th className="num">{t("reports.inReview")}</th>
                    <th className="num">{t("reports.avgDelivery")}</th>
                    <th className="num">{t("reports.rejected")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.clientRequests.map((x) => (
                    <tr key={x.clientId}>
                      <td>{x.name}</td>
                      <td className="num">{x.pending}</td>
                      <td className={`num ${x.overdue ? "danger-text" : ""}`}>{x.overdue}</td>
                      <td className="num">{x.inReview}</td>
                      <td className="num nowrap">{x.avgDeliveryDays === null ? "—" : t("reports.days", { n: x.avgDeliveryDays })}</td>
                      <td className="num">{x.rejected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
