import type { Language } from "../../config/constants.js";

/** Datos del caso y del destinatario: iguales para todos los eventos de un mismo correo. */
export interface ItemContext {
  recipientName: string;
  number: string;
  title: string;
  /** support | task | implementation */
  typeCode: string;
  clientName: string;
  url: string;
  /** Avance de la implementación (0-100); se muestra en los correos de etapas. */
  progress?: number;
  companyName: string;
  brandColor: string;
}

/** Lo propio de cada evento. */
export interface EventDetails {
  actorName: string;
  statusName?: string;
  stageName?: string;
  requestTitle?: string;
  reason?: string;
  excerpt?: string;
}

export interface MailEvent {
  code: string;
  details: EventDetails;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

interface Copy {
  subject: string;
  intro: string;
  quote?: string;
}

type Ctx = ItemContext & EventDetails;
type EventCopy = (c: Ctx) => Copy;

interface LanguagePack {
  kind: Record<string, string>;
  hello: (name: string) => string;
  open: (kind: string) => string;
  footer: (company: string) => string;
  progress: (percent: number) => string;
  someone: string;
  events: Record<string, EventCopy>;
  generic: EventCopy;
}

const ref = (c: Ctx) => `${c.number} · ${c.title}`;

const es: LanguagePack = {
  kind: { support: "ticket", task: "tarea", implementation: "implementación" },
  hello: (n) => `Hola ${n},`,
  open: (k) => `Ver ${k}`,
  footer: (co) => `Recibes este aviso de ${co} porque participas en este caso. Para responder, entra al portal con el botón de arriba.`,
  progress: (p) => `Avance de la implementación: ${p} %.`,
  someone: "Alguien",
  events: {
    "work_item.created": (c) => ({ subject: `Nuevo: ${ref(c)}`, intro: `${c.actorName} registró ${c.number}${c.clientName ? ` para ${c.clientName}` : ""}.` }),
    "work_item.assigned": (c) => ({ subject: `Te asignaron ${ref(c)}`, intro: `${c.actorName} te asignó ${c.number}.` }),
    "work_item.status_changed": (c) => ({ subject: `${c.number}: ahora está «${c.statusName}»`, intro: `${c.actorName} cambió el estado de ${c.number} a «${c.statusName}».` }),
    "comment.public_added": (c) => ({ subject: `Nuevo comentario en ${ref(c)}`, intro: `${c.actorName} escribió:`, quote: c.excerpt }),
    "stage.started": (c) => ({ subject: `Comenzó la etapa «${c.stageName}» · ${c.number}`, intro: `Comenzó la etapa «${c.stageName}».` }),
    "stage.completed": (c) => ({ subject: `Etapa terminada: «${c.stageName}» · ${c.number}`, intro: `Se completó la etapa «${c.stageName}».` }),
    "stage.unlocked": (c) => ({ subject: `Ya puede empezar «${c.stageName}» · ${c.number}`, intro: `La etapa «${c.stageName}» quedó desbloqueada.` }),
    "implementation.completed": (c) => ({ subject: `Implementación terminada: ${ref(c)}`, intro: `Se completaron todas las etapas de ${c.number}. ¡Gracias por tu colaboración!` }),
    "client_request.created": (c) => ({ subject: `Necesitamos algo de ti: ${c.requestTitle}`, intro: `Para avanzar necesitamos que nos entregues: «${c.requestTitle}».` }),
    "client_request.submitted": (c) => ({ subject: `El cliente entregó «${c.requestTitle}» · ${c.number}`, intro: `${c.actorName} entregó «${c.requestTitle}». Revísalo para aceptarlo o devolverlo.` }),
    "client_request.accepted": (c) => ({ subject: `Aceptado: ${c.requestTitle}`, intro: `${c.actorName} aceptó lo que entregaste para «${c.requestTitle}».` }),
    "client_request.rejected": (c) => ({ subject: `Hace falta corregir: ${c.requestTitle}`, intro: `${c.actorName} pidió cambios en «${c.requestTitle}».`, quote: c.reason }),
    test: (c) => ({ subject: `${c.companyName}: correo de prueba`, intro: "Este es un correo de prueba del Helpdesk. Si lo recibes, los avisos por correo funcionan." }),
  },
  generic: (c) => ({ subject: `Novedades en ${ref(c)}`, intro: `Hay novedades en ${c.number}.` }),
};

const en: LanguagePack = {
  kind: { support: "ticket", task: "task", implementation: "implementation" },
  hello: (n) => `Hi ${n},`,
  open: (k) => `View ${k}`,
  footer: (co) => `You receive this notice from ${co} because you take part in this case. To reply, open the portal with the button above.`,
  progress: (p) => `Implementation progress: ${p}%.`,
  someone: "Someone",
  events: {
    "work_item.created": (c) => ({ subject: `New: ${ref(c)}`, intro: `${c.actorName} opened ${c.number}${c.clientName ? ` for ${c.clientName}` : ""}.` }),
    "work_item.assigned": (c) => ({ subject: `You were assigned ${ref(c)}`, intro: `${c.actorName} assigned ${c.number} to you.` }),
    "work_item.status_changed": (c) => ({ subject: `${c.number} is now "${c.statusName}"`, intro: `${c.actorName} changed the status of ${c.number} to "${c.statusName}".` }),
    "comment.public_added": (c) => ({ subject: `New comment on ${ref(c)}`, intro: `${c.actorName} wrote:`, quote: c.excerpt }),
    "stage.started": (c) => ({ subject: `Stage "${c.stageName}" started · ${c.number}`, intro: `Stage "${c.stageName}" has started.` }),
    "stage.completed": (c) => ({ subject: `Stage completed: "${c.stageName}" · ${c.number}`, intro: `Stage "${c.stageName}" was completed.` }),
    "stage.unlocked": (c) => ({ subject: `"${c.stageName}" can start · ${c.number}`, intro: `Stage "${c.stageName}" is now unlocked.` }),
    "implementation.completed": (c) => ({ subject: `Implementation completed: ${ref(c)}`, intro: `Every stage of ${c.number} is complete. Thank you for your collaboration!` }),
    "client_request.created": (c) => ({ subject: `We need something from you: ${c.requestTitle}`, intro: `To move forward we need you to deliver: "${c.requestTitle}".` }),
    "client_request.submitted": (c) => ({ subject: `Client delivered "${c.requestTitle}" · ${c.number}`, intro: `${c.actorName} delivered "${c.requestTitle}". Review it to accept or return it.` }),
    "client_request.accepted": (c) => ({ subject: `Accepted: ${c.requestTitle}`, intro: `${c.actorName} accepted what you delivered for "${c.requestTitle}".` }),
    "client_request.rejected": (c) => ({ subject: `Changes needed: ${c.requestTitle}`, intro: `${c.actorName} asked for changes on "${c.requestTitle}".`, quote: c.reason }),
    test: (c) => ({ subject: `${c.companyName}: test email`, intro: "This is a test email from the Helpdesk. If you got it, email notifications are working." }),
  },
  generic: (c) => ({ subject: `Updates on ${ref(c)}`, intro: `There are updates on ${c.number}.` }),
};

const pt: LanguagePack = {
  kind: { support: "ticket", task: "tarefa", implementation: "implementação" },
  hello: (n) => `Olá ${n},`,
  open: (k) => `Ver ${k}`,
  footer: (co) => `Você recebe este aviso de ${co} porque participa deste caso. Para responder, acesse o portal pelo botão acima.`,
  progress: (p) => `Avanço da implementação: ${p}%.`,
  someone: "Alguém",
  events: {
    "work_item.created": (c) => ({ subject: `Novo: ${ref(c)}`, intro: `${c.actorName} registrou ${c.number}${c.clientName ? ` para ${c.clientName}` : ""}.` }),
    "work_item.assigned": (c) => ({ subject: `${ref(c)} foi atribuído a você`, intro: `${c.actorName} atribuiu ${c.number} a você.` }),
    "work_item.status_changed": (c) => ({ subject: `${c.number} agora está "${c.statusName}"`, intro: `${c.actorName} mudou o status de ${c.number} para "${c.statusName}".` }),
    "comment.public_added": (c) => ({ subject: `Novo comentário em ${ref(c)}`, intro: `${c.actorName} escreveu:`, quote: c.excerpt }),
    "stage.started": (c) => ({ subject: `A etapa "${c.stageName}" começou · ${c.number}`, intro: `A etapa "${c.stageName}" começou.` }),
    "stage.completed": (c) => ({ subject: `Etapa concluída: "${c.stageName}" · ${c.number}`, intro: `A etapa "${c.stageName}" foi concluída.` }),
    "stage.unlocked": (c) => ({ subject: `"${c.stageName}" já pode começar · ${c.number}`, intro: `A etapa "${c.stageName}" foi desbloqueada.` }),
    "implementation.completed": (c) => ({ subject: `Implementação concluída: ${ref(c)}`, intro: `Todas as etapas de ${c.number} foram concluídas. Obrigado pela colaboração!` }),
    "client_request.created": (c) => ({ subject: `Precisamos de algo seu: ${c.requestTitle}`, intro: `Para avançar precisamos que você entregue: "${c.requestTitle}".` }),
    "client_request.submitted": (c) => ({ subject: `O cliente entregou "${c.requestTitle}" · ${c.number}`, intro: `${c.actorName} entregou "${c.requestTitle}". Revise para aceitar ou devolver.` }),
    "client_request.accepted": (c) => ({ subject: `Aceito: ${c.requestTitle}`, intro: `${c.actorName} aceitou o que você entregou para "${c.requestTitle}".` }),
    "client_request.rejected": (c) => ({ subject: `Ajustes necessários: ${c.requestTitle}`, intro: `${c.actorName} pediu ajustes em "${c.requestTitle}".`, quote: c.reason }),
    test: (c) => ({ subject: `${c.companyName}: e-mail de teste`, intro: "Este é um e-mail de teste do Helpdesk. Se você o recebeu, os avisos por e-mail estão funcionando." }),
  },
  generic: (c) => ({ subject: `Novidades em ${ref(c)}`, intro: `Há novidades em ${c.number}.` }),
};

const PACKS: Record<Language, LanguagePack> = { es, en, pt };

/**
 * Orden dentro de un correo que junta varios eventos de una misma acción: el primero da el asunto.
 * Ej.: completar una etapa = "etapa terminada" + "comienza la siguiente" + lo que se le pide al cliente.
 */
export const EVENT_PRIORITY = [
  "implementation.completed",
  "stage.completed",
  "stage.started",
  "stage.unlocked",
  "client_request.created",
  "client_request.rejected",
  "client_request.accepted",
  "client_request.submitted",
  "work_item.assigned",
  "work_item.created",
  "work_item.status_changed",
  "comment.public_added",
];

const STAGE_EVENTS = new Set(["stage.started", "stage.completed", "stage.unlocked", "implementation.completed"]);

export function hasTemplate(eventCode: string): boolean {
  return eventCode in es.events;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

/** Un correo con uno o varios eventos del mismo caso (en el orden recibido; el primero da el asunto). */
export function renderMail(language: Language, item: ItemContext, events: MailEvent[]): RenderedMail {
  const pack = PACKS[language] ?? es;
  const copies = events.map((e) => {
    const ctx: Ctx = { ...item, ...e.details, actorName: e.details.actorName || pack.someone };
    return (pack.events[e.code] ?? pack.generic)(ctx);
  });
  const subject = copies[0]?.subject ?? pack.generic({ ...item, actorName: "" }).subject;
  const kind = pack.kind[item.typeCode] ?? pack.kind.support;
  const button = pack.open(kind);
  const footer = pack.footer(item.companyName);
  const color = /^#[0-9a-f]{6}$/i.test(item.brandColor) ? item.brandColor : "#00387a";
  const progress =
    typeof item.progress === "number" && events.some((e) => STAGE_EVENTS.has(e.code)) ? pack.progress(Math.round(item.progress)) : "";

  const blocks = copies
    .map((c) => {
      const quote = c.quote
        ? `<blockquote style="margin:8px 0 12px;padding:12px 16px;background:#f3f6fa;border-left:4px solid ${color};color:#334155;white-space:pre-wrap">${escapeHtml(c.quote)}</blockquote>`
        : "";
      return `<p style="margin:0 0 8px">${escapeHtml(c.intro)}</p>${quote}`;
    })
    .join("\n");
  const progressHtml = progress ? `<p style="margin:12px 0 0;font-weight:600;color:${color}">${escapeHtml(progress)}</p>` : "";

  const html = `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:${color};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:600">${escapeHtml(item.companyName)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">${escapeHtml(pack.hello(item.recipientName))}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b">${escapeHtml(item.number)}${item.clientName ? ` · ${escapeHtml(item.clientName)}` : ""}</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:600">${escapeHtml(item.title)}</p>
${blocks}
${progressHtml}
<p style="margin:20px 0 0"><a href="${escapeHtml(item.url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${escapeHtml(button)}</a></p>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    pack.hello(item.recipientName),
    "",
    `${item.number} · ${item.title}${item.clientName ? ` (${item.clientName})` : ""}`,
    "",
    ...copies.flatMap((c) => [c.intro, ...(c.quote ? c.quote.split("\n").map((l) => `> ${l}`) : [])]),
    ...(progress ? ["", progress] : []),
    "",
    `${button}: ${item.url}`,
    "",
    "--",
    footer,
  ].join("\n");

  return { subject, html, text };
}

export interface AccessMailContext {
  kind: "welcome" | "reset";
  recipientName: string;
  email: string;
  password: string;
  url: string;
  companyName: string;
  brandColor: string;
}

const ACCESS_COPY: Record<Language, (c: AccessMailContext) => { subject: string; intro: string; user: string; password: string; change: string; button: string }> = {
  es: (c) => ({
    subject: c.kind === "welcome" ? `Tu acceso a ${c.companyName}` : `Nueva contraseña para ${c.companyName}`,
    intro: c.kind === "welcome" ? `Te crearon un usuario en el portal de soporte de ${c.companyName}.` : "Se restableció la contraseña de tu usuario.",
    user: "Usuario",
    password: "Contraseña temporal",
    change: "Al entrar, cámbiala en «Mi cuenta» (haz clic en tu nombre, arriba a la derecha).",
    button: "Entrar al portal",
  }),
  en: (c) => ({
    subject: c.kind === "welcome" ? `Your access to ${c.companyName}` : `New password for ${c.companyName}`,
    intro: c.kind === "welcome" ? `A user was created for you on the ${c.companyName} support portal.` : "Your password was reset.",
    user: "User",
    password: "Temporary password",
    change: "After signing in, change it under “My account” (click your name, top right).",
    button: "Open the portal",
  }),
  pt: (c) => ({
    subject: c.kind === "welcome" ? `Seu acesso a ${c.companyName}` : `Nova senha para ${c.companyName}`,
    intro: c.kind === "welcome" ? `Foi criado um usuário para você no portal de suporte da ${c.companyName}.` : "A senha do seu usuário foi redefinida.",
    user: "Usuário",
    password: "Senha temporária",
    change: "Ao entrar, altere-a em “Minha conta” (clique no seu nome, no canto superior direito).",
    button: "Entrar no portal",
  }),
};

/** Correo con usuario y contraseña temporal (alta de usuario o restablecimiento). */
export function renderAccessMail(language: Language, c: AccessMailContext): RenderedMail {
  const pack = PACKS[language] ?? es;
  const copy = (ACCESS_COPY[language] ?? ACCESS_COPY.es)(c);
  const color = /^#[0-9a-f]{6}$/i.test(c.brandColor) ? c.brandColor : "#00387a";
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:4px 0;font-family:Consolas,monospace;font-weight:600">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:${color};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:600">${escapeHtml(c.companyName)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">${escapeHtml(pack.hello(c.recipientName))}</p>
<p style="margin:0 0 12px">${escapeHtml(copy.intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:#f3f6fa;border-radius:6px;padding:8px 12px">${row(copy.user, c.email)}${row(copy.password, c.password)}</table>
<p style="margin:0 0 4px">${escapeHtml(copy.change)}</p>
<p style="margin:20px 0 0"><a href="${escapeHtml(c.url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${escapeHtml(copy.button)}</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    pack.hello(c.recipientName),
    "",
    copy.intro,
    "",
    `${copy.user}: ${c.email}`,
    `${copy.password}: ${c.password}`,
    "",
    copy.change,
    "",
    `${copy.button}: ${c.url}`,
  ].join("\n");
  return { subject: copy.subject, html, text };
}
