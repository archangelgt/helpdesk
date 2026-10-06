import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import type { EmailSenderRow } from "../../models/notifications.model.js";

export interface MailerConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  replyTo: string;
  /** Hay contraseña y servidor: se puede enviar. */
  ready: boolean;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Variables de entorno primero; lo que falte sale del remitente configurado en la base de datos. */
export function mailerConfig(sender: EmailSenderRow | undefined): MailerConfig {
  const host = env.SMTP_HOST || sender?.smtp_host || "";
  const port = env.SMTP_PORT || sender?.smtp_port || 465;
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465;
  const fromAddress = sender?.from_email ?? "";
  const from = env.MAIL_FROM || (fromAddress ? `"${sender?.name ?? fromAddress}" <${fromAddress}>` : "");
  const user = env.SMTP_USER || fromAddress;
  return {
    host,
    port,
    secure,
    user,
    from,
    replyTo: env.MAIL_REPLY_TO || sender?.reply_to || "",
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

export const mailer = {
  async send(config: MailerConfig, mail: OutgoingMail): Promise<string> {
    const info = await transporterFor(config).sendMail({
      from: config.from,
      replyTo: config.replyTo || undefined,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return info.messageId;
  },

  async verify(config: MailerConfig): Promise<void> {
    await transporterFor(config).verify();
  },
};
