import type { Language } from "../../config/constants.js";

export interface TemplateContext {
  recipientName: string;
  actorName: string;
  number: string;
  title: string;
  /** support | task | implementation */
  typeCode: string;
  clientName: string;
  url: string;
  statusName?: string;
  stageName?: string;
  requestTitle?: string;
  reason?: string;
  excerpt?: string;
  companyName: string;
  brandColor: string;
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

type EventCopy = (c: TemplateContext) => Copy;

interface LanguagePack {
  kind: Record<string, string>;
  hello: (name: string) => string;
  open: (kind: string) => string;
  footer: (company: string) => string;
  someone: string;
  events: Record<string, EventCopy>;
  generic: EventCopy;
}

const ref = (c: TemplateContext) => `${c.number} · ${c.title}`;

const es: LanguagePack = {
  kind: { support: "ticket", task: "tarea", implementation: "implementación" },
  hello: (n) => `Hola ${n},`,
  open: (k) => `Ver ${k}`,
  footer: (co) => `Recibes este aviso de ${co} porque participas en este caso. Para responder, entra al portal con el botón de arriba.`,
  someone: "Alguien",
  events: {
    "work_item.created": (c) => ({ subject: `Nuevo: ${ref(c)}`, intro: `${c.actorName} registró ${c.number}${c.clientName ? ` para ${c.clientName}` : ""}.` }),
    "work_item.assigned": (c) => ({ subject: `Te asignaron ${ref(c)}`, intro: `${c.actorName} te asignó ${c.number}.` }),
    "work_item.status_changed": (c) => ({ subject: `${c.number}: ahora está «${c.statusName}»`, intro: `${c.actorName} cambió el estado de ${c.number} a «${c.statusName}».` }),
    "comment.public_added": (c) => ({ subject: `Nuevo comentario en ${ref(c)}`, intro: `${c.actorName} escribió:`, quote: c.excerpt }),
    "stage.started": (c) => ({ subject: `Comenzó la etapa «${c.stageName}» · ${c.number}`, intro: `La etapa «${c.stageName}» de ${c.number} está en curso.` }),
    "stage.completed": (c) => ({ subject: `Etapa terminada: «${c.stageName}» · ${c.number}`, intro: `Se completó la etapa «${c.stageName}» de ${c.number}.` }),
    "stage.unlocked": (c) => ({ subject: `Ya puede empezar «${c.stageName}» · ${c.number}`, intro: `La etapa «${c.stageName}» de ${c.number} quedó desbloqueada.` }),
    "implementation.completed": (c) => ({ subject: `Implementación terminada: ${ref(c)}`, intro: `Se completaron todas las etapas de ${c.number}. ¡Gracias por tu colaboración!` }),
    "client_request.created": (c) => ({ subject: `Necesitamos algo de ti: ${c.requestTitle}`, intro: `${c.actorName} te pide lo siguiente para avanzar con ${c.number}: «${c.requestTitle}».` }),
    "client_request.submitted": (c) => ({ subject: `El cliente entregó «${c.requestTitle}» · ${c.number}`, intro: `${c.actorName} entregó «${c.requestTitle}». Revísalo para aceptarlo o rechazarlo.` }),
    "client_request.accepted": (c) => ({ subject: `Aceptado: ${c.requestTitle}`, intro: `${c.actorName} aceptó lo que entregaste para «${c.requestTitle}».` }),
    "client_request.rejected": (c) => ({ subject: `Hace falta corregir: ${c.requestTitle}`, intro: `${c.actorName} pidió cambios en «${c.requestTitle}».`, quote: c.reason }),
  },
  generic: (c) => ({ subject: `Novedades en ${ref(c)}`, intro: `Hay novedades en ${c.number}.` }),
};

const en: LanguagePack = {
  kind: { support: "ticket", task: "task", implementation: "implementation" },
  hello: (n) => `Hi ${n},`,
  open: (k) => `View ${k}`,
  footer: (co) => `You receive this notice from ${co} because you take part in this case. To reply, open the portal with the button above.`,
  someone: "Someone",
  events: {
    "work_item.created": (c) => ({ subject: `New: ${ref(c)}`, intro: `${c.actorName} opened ${c.number}${c.clientName ? ` for ${c.clientName}` : ""}.` }),
    "work_item.assigned": (c) => ({ subject: `You were assigned ${ref(c)}`, intro: `${c.actorName} assigned ${c.number} to you.` }),
    "work_item.status_changed": (c) => ({ subject: `${c.number} is now "${c.statusName}"`, intro: `${c.actorName} changed the status of ${c.number} to "${c.statusName}".` }),
    "comment.public_added": (c) => ({ subject: `New comment on ${ref(c)}`, intro: `${c.actorName} wrote:`, quote: c.excerpt }),
    "stage.started": (c) => ({ subject: `Stage "${c.stageName}" started · ${c.number}`, intro: `Stage "${c.stageName}" of ${c.number} is in progress.` }),
    "stage.completed": (c) => ({ subject: `Stage completed: "${c.stageName}" · ${c.number}`, intro: `Stage "${c.stageName}" of ${c.number} was completed.` }),
    "stage.unlocked": (c) => ({ subject: `"${c.stageName}" can start · ${c.number}`, intro: `Stage "${c.stageName}" of ${c.number} is now unlocked.` }),
    "implementation.completed": (c) => ({ subject: `Implementation completed: ${ref(c)}`, intro: `Every stage of ${c.number} is complete. Thank you for your collaboration!` }),
    "client_request.created": (c) => ({ subject: `We need something from you: ${c.requestTitle}`, intro: `${c.actorName} needs the following to move ${c.number} forward: "${c.requestTitle}".` }),
    "client_request.submitted": (c) => ({ subject: `Client delivered "${c.requestTitle}" · ${c.number}`, intro: `${c.actorName} delivered "${c.requestTitle}". Review it to accept or reject it.` }),
    "client_request.accepted": (c) => ({ subject: `Accepted: ${c.requestTitle}`, intro: `${c.actorName} accepted what you delivered for "${c.requestTitle}".` }),
    "client_request.rejected": (c) => ({ subject: `Changes needed: ${c.requestTitle}`, intro: `${c.actorName} asked for changes on "${c.requestTitle}".`, quote: c.reason }),
  },
  generic: (c) => ({ subject: `Updates on ${ref(c)}`, intro: `There are updates on ${c.number}.` }),
};

const pt: LanguagePack = {
  kind: { support: "ticket", task: "tarefa", implementation: "implementação" },
  hello: (n) => `Olá ${n},`,
  open: (k) => `Ver ${k}`,
  footer: (co) => `Você recebe este aviso de ${co} porque participa deste caso. Para responder, acesse o portal pelo botão acima.`,
  someone: "Alguém",
  events: {
    "work_item.created": (c) => ({ subject: `Novo: ${ref(c)}`, intro: `${c.actorName} registrou ${c.number}${c.clientName ? ` para ${c.clientName}` : ""}.` }),
    "work_item.assigned": (c) => ({ subject: `${ref(c)} foi atribuído a você`, intro: `${c.actorName} atribuiu ${c.number} a você.` }),
    "work_item.status_changed": (c) => ({ subject: `${c.number} agora está "${c.statusName}"`, intro: `${c.actorName} mudou o status de ${c.number} para "${c.statusName}".` }),
    "comment.public_added": (c) => ({ subject: `Novo comentário em ${ref(c)}`, intro: `${c.actorName} escreveu:`, quote: c.excerpt }),
    "stage.started": (c) => ({ subject: `A etapa "${c.stageName}" começou · ${c.number}`, intro: `A etapa "${c.stageName}" de ${c.number} está em andamento.` }),
    "stage.completed": (c) => ({ subject: `Etapa concluída: "${c.stageName}" · ${c.number}`, intro: `A etapa "${c.stageName}" de ${c.number} foi concluída.` }),
    "stage.unlocked": (c) => ({ subject: `"${c.stageName}" já pode começar · ${c.number}`, intro: `A etapa "${c.stageName}" de ${c.number} foi desbloqueada.` }),
    "implementation.completed": (c) => ({ subject: `Implementação concluída: ${ref(c)}`, intro: `Todas as etapas de ${c.number} foram concluídas. Obrigado pela colaboração!` }),
    "client_request.created": (c) => ({ subject: `Precisamos de algo seu: ${c.requestTitle}`, intro: `${c.actorName} precisa do seguinte para avançar com ${c.number}: "${c.requestTitle}".` }),
    "client_request.submitted": (c) => ({ subject: `O cliente entregou "${c.requestTitle}" · ${c.number}`, intro: `${c.actorName} entregou "${c.requestTitle}". Revise para aceitar ou recusar.` }),
    "client_request.accepted": (c) => ({ subject: `Aceito: ${c.requestTitle}`, intro: `${c.actorName} aceitou o que você entregou para "${c.requestTitle}".` }),
    "client_request.rejected": (c) => ({ subject: `Ajustes necessários: ${c.requestTitle}`, intro: `${c.actorName} pediu ajustes em "${c.requestTitle}".`, quote: c.reason }),
  },
  generic: (c) => ({ subject: `Novidades em ${ref(c)}`, intro: `Há novidades em ${c.number}.` }),
};

const PACKS: Record<Language, LanguagePack> = { es, en, pt };

export function hasTemplate(eventCode: string): boolean {
  return eventCode in es.events;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

export function renderMail(eventCode: string, language: Language, ctx: TemplateContext): RenderedMail {
  const pack = PACKS[language] ?? es;
  const c = { ...ctx, actorName: ctx.actorName || pack.someone };
  const copy = (pack.events[eventCode] ?? pack.generic)(c);
  const kind = pack.kind[c.typeCode] ?? pack.kind.support;
  const button = pack.open(kind);
  const footer = pack.footer(c.companyName);
  const color = /^#[0-9a-f]{6}$/i.test(c.brandColor) ? c.brandColor : "#00387a";

  const quoteHtml = copy.quote
    ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#f3f6fa;border-left:4px solid ${color};color:#334155;white-space:pre-wrap">${escapeHtml(copy.quote)}</blockquote>`
    : "";
  const html = `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:${color};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:600">${escapeHtml(c.companyName)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">${escapeHtml(pack.hello(c.recipientName))}</p>
<p style="margin:0 0 4px">${escapeHtml(copy.intro)}</p>
${quoteHtml}
<p style="margin:16px 0 4px;font-size:13px;color:#64748b">${escapeHtml(c.number)}${c.clientName ? ` · ${escapeHtml(c.clientName)}` : ""}</p>
<p style="margin:0 0 20px;font-size:16px;font-weight:600">${escapeHtml(c.title)}</p>
<a href="${escapeHtml(c.url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${escapeHtml(button)}</a>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    pack.hello(c.recipientName),
    "",
    copy.intro,
    ...(copy.quote ? ["", ...copy.quote.split("\n").map((l) => `> ${l}`)] : []),
    "",
    `${c.number} · ${c.title}${c.clientName ? ` (${c.clientName})` : ""}`,
    `${button}: ${c.url}`,
    "",
    "--",
    footer,
  ].join("\n");

  return { subject: copy.subject, html, text };
}
