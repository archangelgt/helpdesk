package pb

// Roles de aplicación.
const (
	RoleMaestro = "maestro"
	RoleAgente  = "agente"
	RoleCliente = "cliente"
)

// Permisos granulares (además del rol).
const (
	PermCrear    = "crear"    // crear tickets
	PermEditar   = "editar"   // editar datos / etapas / comentarios de trabajo
	PermResolver = "resolver" // marcar resuelto / cerrado
	PermAdmin    = "admin"    // plantillas, empresas, usuarios
)

var AllRoles = []string{RoleMaestro, RoleAgente, RoleCliente}
var AllPermissions = []string{PermCrear, PermEditar, PermResolver, PermAdmin}

// DefaultPermissions returns the permission set for a role when none are stored.
func DefaultPermissions(role string) []string {
	switch role {
	case RoleMaestro:
		return []string{PermCrear, PermEditar, PermResolver, PermAdmin}
	case RoleAgente:
		return []string{PermCrear, PermEditar, PermResolver}
	case RoleCliente:
		return []string{PermCrear}
	default:
		return nil
	}
}

// EffectivePermissions returns stored permissions.
// Maestro always has the full set. Empty slice means no permissions (explicit).
func (u *AppUser) EffectivePermissions() []string {
	if u == nil {
		return nil
	}
	if u.Role == RoleMaestro {
		return DefaultPermissions(RoleMaestro)
	}
	return u.Permissions
}

func (u *AppUser) HasPerm(perm string) bool {
	if u == nil || !u.Active {
		return false
	}
	if u.Role == RoleMaestro {
		return true
	}
	for _, p := range u.EffectivePermissions() {
		if p == perm {
			return true
		}
	}
	return false
}

func (u *AppUser) IsStaff() bool {
	return u != nil && u.Active && (u.Role == RoleMaestro || u.Role == RoleAgente)
}

func (u *AppUser) IsCliente() bool {
	return u != nil && u.Role == RoleCliente
}

// DefaultTemplateRoles: who may use a template when allowed_roles is empty.
func DefaultTemplateRoles(ticketType string) []string {
	if ticketType == "implementacion" {
		return []string{RoleMaestro}
	}
	return []string{RoleMaestro, RoleAgente, RoleCliente}
}

// RolesAllowed returns configured roles or type defaults.
func (t TicketTemplate) RolesAllowed() []string {
	if len(t.AllowedRoles) > 0 {
		return t.AllowedRoles
	}
	return DefaultTemplateRoles(t.Type)
}

// CanUseTemplate reports whether the user may start a ticket from this template.
func CanUseTemplate(u *AppUser, t *TicketTemplate) bool {
	if u == nil || t == nil || !u.HasPerm(PermCrear) {
		return false
	}
	// Solo maestros crean implementación (aunque la plantilla liste otros roles).
	if t.Type == "implementacion" && u.Role != RoleMaestro {
		return false
	}
	role := u.Role
	for _, r := range t.RolesAllowed() {
		if r == role {
			return true
		}
	}
	return false
}
