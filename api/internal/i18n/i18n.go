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
		"nav.login": "Entrar", "nav.logout": "Salir", "nav.settings": "Idioma / tema",
		"app.name": "HELPDESK",
		"login.title": "Entrar", "login.lead": "Maestros operan todas las empresas; clientes ven solo sus tickets.",
		"login.email": "Correo", "login.password": "Contraseña", "login.submit": "Entrar",
		"login.hint": "Demo: maestro@helpdesk.local / maestro123 · cliente.cap@helpdesk.local / cliente123",
		"prefs.title": "Idioma y apariencia",
		"prefs.lang": "Idioma", "prefs.theme": "Tema",
		"prefs.light": "Claro", "prefs.dark": "Oscuro", "prefs.auto": "Automático (por hora)",
		"prefs.save": "Guardar",
		"portal.title": "Mis tickets", "portal.lead": "Consulta estado, avance y agrega comentarios.",
		"portal.empty": "Aún no tienes tickets.", "portal.comment": "Agregar comentario",
		"portal.comment.placeholder": "Escribe un mensaje para el equipo…",
		"portal.stages": "Avance / etapas", "portal.comments": "Comentarios",
		"portal.back": "← Mis tickets", "portal.only_client": "Solo comentarios visibles al cliente.",
		"board.title": "Tablero", "board.new": "+ Nuevo ticket",
		"board.by_status": "Por estado", "board.by_priority": "Por prioridad", "board.by_lane": "Por avance",
		"lane.atrasados": "Atrasados", "lane.activos": "En curso", "lane.terminados": "Terminados",
		"lane.hint": "Los terminados se ocultan a los 14 días.",
		"status.abierto": "Abierto", "status.pendiente": "Pendiente", "status.en_proceso": "En proceso",
		"status.resuelto": "Resuelto", "status.cerrado": "Cerrado",
		"priority.baja": "Baja", "priority.media": "Media", "priority.alta": "Alta", "priority.critica": "Crítica",
		"type.implementacion": "Implementación", "type.soporte": "Soporte",
		"vis.interno": "Interno", "vis.cliente": "Cliente", "vis.sistema": "Sistema",
		"stage.pendiente": "Pendiente", "stage.en_curso": "En curso", "stage.hecha": "Hecha", "stage.pausada": "Pausada",
		"role.maestro": "Maestro", "role.cliente": "Cliente",
		"tenants.title": "Empresas", "tenants.lead": "Tenants aislados. El maestro ve todas; el cliente solo la suya.",
		"flash.saved": "Preferencias guardadas",
		"err.auth": "Correo o contraseña incorrectos",
		"err.forbidden": "No tienes permiso para esta página",
	},
	EN: {
		"nav.board": "Board", "nav.list": "List", "nav.new": "New",
		"nav.templates": "Templates", "nav.categories": "Categories",
		"nav.tenants": "Companies", "nav.portal": "My tickets",
		"nav.login": "Sign in", "nav.logout": "Sign out", "nav.settings": "Language / theme",
		"app.name": "HELPDESK",
		"login.title": "Sign in", "login.lead": "Masters operate all companies; clients only see their tickets.",
		"login.email": "Email", "login.password": "Password", "login.submit": "Sign in",
		"login.hint": "Demo: maestro@helpdesk.local / maestro123 · cliente.cap@helpdesk.local / cliente123",
		"prefs.title": "Language & appearance",
		"prefs.lang": "Language", "prefs.theme": "Theme",
		"prefs.light": "Light", "prefs.dark": "Dark", "prefs.auto": "Automatic (by hour)",
		"prefs.save": "Save",
		"portal.title": "My tickets", "portal.lead": "Check status, progress, and add comments.",
		"portal.empty": "You have no tickets yet.", "portal.comment": "Add comment",
		"portal.comment.placeholder": "Write a message for the team…",
		"portal.stages": "Progress / stages", "portal.comments": "Comments",
		"portal.back": "← My tickets", "portal.only_client": "Only client-visible comments.",
		"board.title": "Board", "board.new": "+ New ticket",
		"board.by_status": "By status", "board.by_priority": "By priority", "board.by_lane": "By progress",
		"lane.atrasados": "Overdue", "lane.activos": "In progress", "lane.terminados": "Done",
		"lane.hint": "Done tickets hide after 14 days.",
		"status.abierto": "Open", "status.pendiente": "Pending", "status.en_proceso": "In progress",
		"status.resuelto": "Resolved", "status.cerrado": "Closed",
		"priority.baja": "Low", "priority.media": "Medium", "priority.alta": "High", "priority.critica": "Critical",
		"type.implementacion": "Implementation", "type.soporte": "Support",
		"vis.interno": "Internal", "vis.cliente": "Client", "vis.sistema": "System",
		"stage.pendiente": "Pending", "stage.en_curso": "In progress", "stage.hecha": "Done", "stage.pausada": "Paused",
		"role.maestro": "Master", "role.cliente": "Client",
		"tenants.title": "Companies", "tenants.lead": "Isolated tenants. Masters see all; clients only theirs.",
		"flash.saved": "Preferences saved",
		"err.auth": "Invalid email or password",
		"err.forbidden": "You do not have access to this page",
	},
	PT: {
		"nav.board": "Painel", "nav.list": "Lista", "nav.new": "Novo",
		"nav.templates": "Modelos", "nav.categories": "Categorias",
		"nav.tenants": "Empresas", "nav.portal": "Meus tickets",
		"nav.login": "Entrar", "nav.logout": "Sair", "nav.settings": "Idioma / tema",
		"app.name": "HELPDESK",
		"login.title": "Entrar", "login.lead": "Mestres operam todas as empresas; clientes veem só os seus tickets.",
		"login.email": "E-mail", "login.password": "Senha", "login.submit": "Entrar",
		"login.hint": "Demo: maestro@helpdesk.local / maestro123 · cliente.cap@helpdesk.local / cliente123",
		"prefs.title": "Idioma e aparência",
		"prefs.lang": "Idioma", "prefs.theme": "Tema",
		"prefs.light": "Claro", "prefs.dark": "Escuro", "prefs.auto": "Automático (por hora)",
		"prefs.save": "Salvar",
		"portal.title": "Meus tickets", "portal.lead": "Consulte status, progresso e adicione comentários.",
		"portal.empty": "Você ainda não tem tickets.", "portal.comment": "Adicionar comentário",
		"portal.comment.placeholder": "Escreva uma mensagem para a equipe…",
		"portal.stages": "Progresso / etapas", "portal.comments": "Comentários",
		"portal.back": "← Meus tickets", "portal.only_client": "Apenas comentários visíveis ao cliente.",
		"board.title": "Painel", "board.new": "+ Novo ticket",
		"board.by_status": "Por status", "board.by_priority": "Por prioridade", "board.by_lane": "Por progresso",
		"lane.atrasados": "Atrasados", "lane.activos": "Em andamento", "lane.terminados": "Concluídos",
		"lane.hint": "Concluídos somem após 14 dias.",
		"status.abierto": "Aberto", "status.pendiente": "Pendente", "status.en_proceso": "Em andamento",
		"status.resuelto": "Resolvido", "status.cerrado": "Fechado",
		"priority.baja": "Baixa", "priority.media": "Média", "priority.alta": "Alta", "priority.critica": "Crítica",
		"type.implementacion": "Implementação", "type.soporte": "Suporte",
		"vis.interno": "Interno", "vis.cliente": "Cliente", "vis.sistema": "Sistema",
		"stage.pendiente": "Pendente", "stage.en_curso": "Em andamento", "stage.hecha": "Concluída", "stage.pausada": "Pausada",
		"role.maestro": "Mestre", "role.cliente": "Cliente",
		"tenants.title": "Empresas", "tenants.lead": "Tenants isolados. Mestres veem todos; clientes só o seu.",
		"flash.saved": "Preferências salvas",
		"err.auth": "E-mail ou senha incorretos",
		"err.forbidden": "Você não tem permissão para esta página",
	},
}
