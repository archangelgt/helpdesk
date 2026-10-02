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
  "common.configuration_error": "Falta configuração no sistema. Fale com o administrador.",
  "workflow.invalid_transition": "Essa mudança de status não é permitida a partir do status atual.",
  "workflow.comment_required": "Esta mudança de status exige um comentário.",
  "work_item.without_stages": "Este tipo de caso não usa etapas.",
  "work_item.stages_pending": "A implantação é concluída ao fechar todas as suas etapas.",
  "stage.dependencies_pending": "A etapa não pode começar: há etapas anteriores sem terminar.",
  "stage.client_requests_pending": "A etapa não pode ser concluída: há solicitações obrigatórias do cliente sem aceitar.",
  "stage.requires_client_approval": "Esta etapa precisa da aprovação do cliente: envie para revisão.",
  "client_request.invalid_state": "A solicitação não está em um estado que permita esta ação.",
};

export default pt;
