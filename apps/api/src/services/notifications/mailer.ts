import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import type { EmailSenderRow } from "../../models/notifications.model.js";

const DEFAULT_MAIL_API_URL = "https://cpaas.zoho.com/v1.1/email";

export interface MailerConfig {
  /** "api" = API de correo de Zoho (MAIL_API_KEY); "smtp" = servidor SMTP. */
  transport: "api" | "smtp";
  /** URL de la API o servidor SMTP, para mostrar en la configuración. */
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromAddress: string;
  fromName: string;
  /** Remitente con formato `"Nombre" <correo>`. */
  from: string;
  replyTo: string;
  /** Hay credenciales y remitente: se puede enviar. */
  ready: boolean;
}

export interface OutgoingMail {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

/** Variables de entorno primero; lo que falte sale del remitente configurado en la base de datos. */
export function mailerConfig(sender: EmailSenderRow | undefined): MailerConfig {
  const fromAddress = sender?.from_email ?? "";
  const fromName = sender?.name ?? "";
  const from = env.MAIL_FROM || (fromAddress ? `"${fromName || fromAddress}" <${fromAddress}>` : "");
  const replyTo = env.MAIL_REPLY_TO || sender?.reply_to || "";

  if (env.MAIL_API_KEY) {
    return {
      transport: "api",
      host: env.MAIL_API_URL || DEFAULT_MAIL_API_URL,
      port: 443,
      secure: true,
      user: "",
      fromAddress,
      fromName,
      from,
      replyTo,
      ready: Boolean(fromAddress),
    };
  }

  const host = env.SMTP_HOST || sender?.smtp_host || "";
  const port = env.SMTP_PORT || sender?.smtp_port || 465;
  const user = env.SMTP_USER || fromAddress;
  return {
    transport: "smtp",
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    user,
    fromAddress,
    fromName,
    from,
    replyTo,
    ready: Boolean(host && user && from && env.SMTP_PASSWORD),
  };
}

let cached: { key: string; transporter: Transporter } | null = null;

function transporterFor(config: MailerConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (cached?.key === key) return cached.transporter;
  cached?.transporter.close();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: env.SMTP_PASSWORD },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  cached = { key, transporter };
  return transporter;
}

/** API de correo de Zoho (mismo formato que ZeptoMail): POST JSON con la clave "Zoho-enczapikey …". */
async function sendViaApi(config: MailerConfig, mail: OutgoingMail): Promise<string> {
  const res = await fetch(config.host, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: env.MAIL_API_KEY },
    body: JSON.stringify({
      from: { address: config.fromAddress, ...(config.fromName && { name: config.fromName }) },
      to: [{ email_address: { address: mail.to, ...(mail.toName && { name: mail.toName }) } }],
      ...(config.replyTo && { reply_to: [{ address: config.replyTo }] }),
      subject: mail.subject,
      htmlbody: mail.html,
      textbody: mail.text,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => null)) as {
    request_id?: string;
    message?: string;
    error?: { code?: string; message?: string; details?: { message?: string; target?: string }[] };
  } | null;
  if (!res.ok) {
    const detail = body?.error?.details?.map((d) => [d.target, d.message].filter(Boolean).join(": ")).join("; ");
    throw new Error(`API de correo ${res.status}: ${[body?.error?.message ?? body?.message, detail].filter(Boolean).join(" — ") || res.statusText}`);
  }
  return body?.request_id ?? "";
}

export const mailer = {
  async send(config: MailerConfig, mail: OutgoingMail): Promise<string> {
    if (config.transport === "api") return sendViaApi(config, mail);
    const info = await transporterFor(config).sendMail({
      from: config.from,
      replyTo: config.replyTo || undefined,
      to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return info.messageId;
  },
};
