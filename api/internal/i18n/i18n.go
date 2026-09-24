package i18n

import "strings"

type Lang string

const (
	ES Lang = "es"
	EN Lang = "en"
	PT Lang = "pt"
)

func Parse(s string) Lang {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "en", "en-us", "en-gb":
		return EN
	case "pt", "pt-br", "pt-pt":
		return PT
	default:
		return ES
	}
}

func (l Lang) String() string { return string(l) }

// T returns the translation for key in lang (falls back to ES then key).
func T(lang Lang, key string) string {
	if m, ok := catalogs[lang]; ok {
		if v, ok := m[key]; ok {
			return v
		}
	}
	if lang != ES {
		if v, ok := catalogs[ES][key]; ok {
			return v
		}
	}
	return key
}

// Func returns a template-friendly translator for one language.
func Func(lang Lang) func(string) string {
	return func(key string) string { return T(lang, key) }
}

var catalogs = map[Lang]map[string]string{
	ES: {
		"nav.board": "Tablero", "nav.list": "Lista", "nav.new": "Nuevo",
		"nav.templates": "Plantillas", "nav.categories": "Categorías",
		"nav.tenants": "Empresas", "nav.portal": "Mis tickets",
		"nav.login": "Iniciar sesión", "nav.logout": "Cerrar sesión", "nav.settings": "Configuración",
		"app.name": "HELPDESK",
		"login.title": "Iniciar sesión", "login.lead": "Acceso al sistema de helpdesk.",
		"login.email": "Correo electrónico", "login.password": "Contraseña", "login.submit": "Iniciar sesión",
		"login.hint": "",
		"prefs.title": "Configuración",
		"prefs.lang": "Idioma", "prefs.theme": "Tema",
		"prefs.light": "Claro", "prefs.dark": "Oscuro", "prefs.auto": "Automático",
		"prefs.save": "Aplicar",
		"portal.title": "Mis tickets", "portal.lead": "Estado, avance y comentarios de sus solicitudes.",
		"portal.empty": "No hay tickets registrados.", "portal.comment": "Agregar comentario",
		"portal.comment.placeholder": "Escriba su mensaje…",
		"portal.stages": "Etapas", "portal.comments": "Comentarios",
		"portal.back": "← Mis tickets", "portal.only_client": "Comentarios visibles para el cliente.",
		"board.title": "Tablero", "board.new": "Nuevo ticket",
		"board.by_status": "Por estado", "board.by_priority": "Por prioridad", "board.by_lane": "Por avance",
		"lane.atrasados": "Atrasados", "lane.activos": "En curso", "lane.terminados": "Terminados",
		"lane.hint": "Los tickets terminados se ocultan después de 14 días.",
		"status.abierto": "Abierto", "status.pendiente": "Pendiente", "status.en_proceso": "En proceso",
		"status.resuelto": "Resuelto", "status.cerrado": "Cerrado",
		"priority.baja": "Baja", "priority.media": "Media", "priority.alta": "Alta", "priority.critica": "Crítica",
		"type.implementacion": "Implementación", "type.soporte": "Soporte",
		"vis.interno": "Interno", "vis.cliente": "Cliente", "vis.sistema": "Sistema",
		"stage.pendiente": "Pendiente", "stage.en_curso": "En curso", "stage.hecha": "Hecha", "stage.pausada": "Pausada",
		"role.maestro": "Maestro", "role.cliente": "Cliente",
		"tenants.title": "Empresas", "tenants.lead": "",
		"flash.saved": "Preferencias actualizadas",
		"err.auth": "Correo o contraseña incorrectos",
		"err.forbidden": "No tiene permiso para esta página",
	},
	EN: {
		"nav.board": "Board", "nav.list": "List", "nav.new": "New",
		"nav.templates": "Templates", "nav.categories": "Categories",
		"nav.tenants": "Companies", "nav.portal": "My tickets",
		"nav.login": "Sign in", "nav.logout": "Sign out", "nav.settings": "Settings",
		"app.name": "HELPDESK",
		"login.title": "Sign in", "login.lead": "Access to the helpdesk system.",
		"login.email": "Email", "login.password": "Password", "login.submit": "Sign in",
		"login.hint": "",
		"prefs.title": "Settings",
		"prefs.lang": "Language", "prefs.theme": "Theme",
		"prefs.light": "Light", "prefs.dark": "Dark", "prefs.auto": "Automatic",
		"prefs.save": "Apply",
		"portal.title": "My tickets", "portal.lead": "Status, progress, and comments for your requests.",
		"portal.empty": "No tickets found.", "portal.comment": "Add comment",
		"portal.comment.placeholder": "Write your message…",
		"portal.stages": "Stages", "portal.comments": "Comments",
		"portal.back": "← My tickets", "portal.only_client": "Comments visible to the client.",
		"board.title": "Board", "board.new": "New ticket",
		"board.by_status": "By status", "board.by_priority": "By priority", "board.by_lane": "By progress",
		"lane.atrasados": "Overdue", "lane.activos": "In progress", "lane.terminados": "Done",
		"lane.hint": "Completed tickets are hidden after 14 days.",
		"status.abierto": "Open", "status.pendiente": "Pending", "status.en_proceso": "In progress",
		"status.resuelto": "Resolved", "status.cerrado": "Closed",
		"priority.baja": "Low", "priority.media": "Medium", "priority.alta": "High", "priority.critica": "Critical",
		"type.implementacion": "Implementation", "type.soporte": "Support",
		"vis.interno": "Internal", "vis.cliente": "Client", "vis.sistema": "System",
		"stage.pendiente": "Pending", "stage.en_curso": "In progress", "stage.hecha": "Done", "stage.pausada": "Paused",
		"role.maestro": "Master", "role.cliente": "Client",
		"tenants.title": "Companies", "tenants.lead": "",
		"flash.saved": "Preferences updated",
		"err.auth": "Invalid email or password",
		"err.forbidden": "You do not have access to this page",
	},
	PT: {
		"nav.board": "Painel", "nav.list": "Lista", "nav.new": "Novo",
		"nav.templates": "Modelos", "nav.categories": "Categorias",
		"nav.tenants": "Empresas", "nav.portal": "Meus tickets",
		"nav.login": "Entrar", "nav.logout": "Sair", "nav.settings": "Configurações",
		"app.name": "HELPDESK",
		"login.title": "Entrar", "login.lead": "Acesso ao sistema de helpdesk.",
		"login.email": "E-mail", "login.password": "Senha", "login.submit": "Entrar",
		"login.hint": "",
		"prefs.title": "Configurações",
		"prefs.lang": "Idioma", "prefs.theme": "Tema",
		"prefs.light": "Claro", "prefs.dark": "Escuro", "prefs.auto": "Automático",
		"prefs.save": "Aplicar",
		"portal.title": "Meus tickets", "portal.lead": "Status, progresso e comentários das suas solicitações.",
		"portal.empty": "Não há tickets registrados.", "portal.comment": "Adicionar comentário",
		"portal.comment.placeholder": "Escreva sua mensagem…",
		"portal.stages": "Etapas", "portal.comments": "Comentários",
		"portal.back": "← Meus tickets", "portal.only_client": "Comentários visíveis ao cliente.",
		"board.title": "Painel", "board.new": "Novo ticket",
		"board.by_status": "Por status", "board.by_priority": "Por prioridade", "board.by_lane": "Por progresso",
		"lane.atrasados": "Atrasados", "lane.activos": "Em andamento", "lane.terminados": "Concluídos",
		"lane.hint": "Tickets concluídos ficam ocultos após 14 dias.",
		"status.abierto": "Aberto", "status.pendiente": "Pendente", "status.en_proceso": "Em andamento",
		"status.resuelto": "Resolvido", "status.cerrado": "Fechado",
		"priority.baja": "Baixa", "priority.media": "Média", "priority.alta": "Alta", "priority.critica": "Crítica",
		"type.implementacion": "Implementação", "type.soporte": "Suporte",
		"vis.interno": "Interno", "vis.cliente": "Cliente", "vis.sistema": "Sistema",
		"stage.pendiente": "Pendente", "stage.en_curso": "Em andamento", "stage.hecha": "Concluída", "stage.pausada": "Pausada",
		"role.maestro": "Mestre", "role.cliente": "Cliente",
		"tenants.title": "Empresas", "tenants.lead": "",
		"flash.saved": "Preferências atualizadas",
		"err.auth": "E-mail ou senha incorretos",
		"err.forbidden": "Você não tem permissão para esta página",
	},
}
