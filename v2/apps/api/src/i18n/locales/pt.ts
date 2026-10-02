import type es from "./es.js";

const pt: Record<keyof typeof es, string> = {
  "validation.invalid": "Os dados enviados não são válidos.",
  "auth.invalid_credentials": "E-mail ou senha incorretos.",
  "auth.unauthorized": "Você precisa entrar.",
  "auth.session_expired": "Sua sessão expirou. Entre novamente.",
  "auth.account_suspended": "Sua conta está suspensa. Fale com o administrador.",
  "auth.account_without_role": "Sua conta não tem um papel atribuído. Fale com o administrador.",
  "auth.forbidden": "Você não tem permissão para realizar esta ação.",
  "common.not_found": "O recurso solicitado não foi encontrado.",
  "common.too_many_requests": "Muitas tentativas. Aguarde um momento e tente novamente.",
  "common.internal_error": "Ocorreu um erro inesperado. Tente novamente.",
};

export default pt;
