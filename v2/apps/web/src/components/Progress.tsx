import type { CSSProperties, ReactNode } from "react";

export function ProgressRing({ value, size = 96 }: { value: number; size?: number }) {
  const style = { "--p": value, "--size": `${size}px` } as CSSProperties;
  return (
    <div className="ring" style={style} role="img" aria-label={`${value}%`}>
      <span>{value}%</span>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${value}%` }} />
    </div>
  );
}

export type PillTone = "ok" | "warn" | "client" | "muted" | "danger" | "info";

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
