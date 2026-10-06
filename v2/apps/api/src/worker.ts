import { writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { env } from "./config/env.js";
import { notificationDispatcher } from "./services/notifications/dispatcher.js";

/** Proceso aparte de la API: toma los eventos del outbox y envía los avisos. Su healthcheck lee el latido. */
export const HEARTBEAT_FILE = "/tmp/worker-heartbeat";

let stopping = false;
const stop = (signal: string) => {
  log("info", "shutting down", { signal });
  stopping = true;
};
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

function log(level: "info" | "error", msg: string, extra: Record<string, unknown> = {}) {
  if (level === "info" && env.LOG_LEVEL !== "info" && env.LOG_LEVEL !== "debug" && env.LOG_LEVEL !== "trace") return;
  process.stdout.write(`${JSON.stringify({ level, time: new Date().toISOString(), service: "worker", msg, ...extra })}\n`);
}

log("info", "worker started", { pollMs: env.WORKER_POLL_MS });
while (!stopping) {
  try {
    const { events, sent } = await notificationDispatcher.tick();
    if (events || sent) log("info", "tick", { events, sent });
    await writeFile(HEARTBEAT_FILE, String(Date.now()));
  } catch (err) {
    log("error", "tick failed", { error: err instanceof Error ? err.message : String(err) });
  }
  await sleep(env.WORKER_POLL_MS);
}
process.exit(0);
