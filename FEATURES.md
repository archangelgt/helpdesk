# Características del Help Desk

Un software Help Desk centraliza, organiza y da seguimiento a las solicitudes de soporte. En este producto **toda entrada es un ticket**; los canales (email, portal, chat) alimentan o continúan tickets, no sustituyen la cola.

## Decisión de producto: tickets como entrada

| Canal | Rol |
|-------|-----|
| Portal / UI agentes | Crear y gestionar tickets |
| Email | Crear ticket o responder al hilo del ticket |
| Chat | Solo **sobre un ticket** (hilo del ticket), no chat libre aparte de la cola |
| WhatsApp / teléfono / API | Fuera de alcance hasta decisión explícita |

Comentarios:

- **Interno** — solo técnicos / agentes  
- **Respuesta al cliente** — visible o enviada al cliente  

---

## 1. Gestión de tickets

Función principal.

- Creación por cliente o usuario  
- Número único de ticket  
- Asunto y descripción  
- Prioridad: baja, media, alta, crítica  
- Estado: abierto, pendiente, en proceso, resuelto, cerrado  
- Asignación a técnico o departamento  
- Categorías y subcategorías  
- Historial completo de cambios y acciones  
- Archivos adjuntos (capturas, documentos)  

**Fase:** núcleo en MVP (Fase 2); adjuntos y categorías completas según roadmap.

## 2. Gestión de clientes y usuarios

Quién solicita el soporte.

- Información del cliente  
- Contactos y usuarios asociados  
- Empresa / sucursal / departamento  
- Historial de tickets por cliente  
- Productos o servicios contratados  
- Datos de contacto  
- Permisos y roles  

Cadena útil (ERP / cuentas):

`Cliente → Empresa → Producto contratado → Tickets abiertos → Historial de soporte`

**Fase:** cliente + agentes en MVP; producto contratado y jerarquía empresa en fases posteriores.

## 3. Panel de control y métricas

- Tickets abiertos / pendientes / resueltos / vencidos  
- Por técnico, cliente, categoría  
- Tiempo promedio de respuesta y de resolución  
- Cantidad por período  
- Cumplimiento de SLA  

**Fase:** métricas mínimas en hardening; panel completo después del MVP.

## 4. SLA (Service Level Agreement)

Ejemplo de matriz:

| Prioridad | Tiempo de respuesta | Tiempo de resolución |
|-----------|---------------------|----------------------|
| Crítica | 15 min | 4 horas |
| Alta | 1 hora | 8 horas |
| Media | 4 horas | 24 horas |
| Baja | 8 horas | 72 horas |

Alertas cuando un ticket está cerca de incumplir el SLA.

**Fase:** post-MVP (hardening / fase SLA dedicada). No en MVP.

## 5. Comunicación con el cliente

El cliente no debería depender siempre de entrar al sistema.

- Correo → creación automática de ticket  
- Respuestas por correo  
- Portal web  
- Chat **ligado al ticket**  
- Notificaciones  
- Comentarios internos vs visibles al cliente  
- Plantillas de respuesta  

**Fase:** comentarios (interno / cliente) en MVP; email→ticket Fase 3; chat-on-ticket Fase 4.

## 6. Automatización

Ejemplos:

- Categoría = Facturación → asignar a Contabilidad  
- Prioridad = Crítica → notificar supervisor  
- 24 h sin respuesta → alerta  
- Cliente responde ticket cerrado → reabrir  

También: reglas, asignación automática, respuestas automáticas, recordatorios, escalamiento, cambio de estados.

**Fase:** post-MVP; reglas simples tras email.

## 7. Base de conocimientos

Artículos para problemas frecuentes (p. ej. “No puedo iniciar sesión”) para reducir tickets humanos.

**Fase:** fuera del MVP; fase posterior.

## 8. Búsqueda e historial

Buscar por: número, cliente, usuario, NIT, correo, técnico, estado, categoría, fecha, palabras clave.

Consulta tipo: *¿Qué problemas ha tenido este cliente en los últimos 6 meses?*

**Fase:** búsqueda simple en MVP; avanzada después.

## 9. Roles y permisos

| Rol | Acceso típico |
|-----|----------------|
| Administrador | Configuración, usuarios, reportes, permisos |
| Supervisor | Todos los tickets, asignar, métricas |
| Técnico | Tickets asignados, responder, cambiar estados |
| Cliente | Crear / ver / responder sus tickets |

**Fase:** agentes + separación cliente en MVP; matriz completa en hardening.

## 10. Archivos y evidencias

Imágenes, PDF, Excel, videos, logs, capturas, documentos — con quién adjuntó y cuándo.

**Fase:** post-MVP cercano (después de cola estable).

## 11. Auditoría

Registro de acciones (quién creó, asignó, cambió prioridad, respondió, cuándo).

**Fase:** hardening.

## 12. Multicanal

Portal, correo, WhatsApp, chat, teléfono, móvil, API → **mismo sistema de tickets**.

**Fase:** portal + email primero; resto solo con decisión explícita ([BOUNDARIES.md](./BOUNDARIES.md)).

---

## Mapa rápido fase ↔ feature

| Feature | MVP | Luego |
|---------|-----|--------|
| Tickets (cola, estados, prioridad, asignación, comentarios) | Sí | — |
| Clientes Cap World / Power Tech | Sí | Jerarquía empresa/producto |
| Comentario interno vs cliente | Sí (básico) | Plantillas |
| Email → ticket | No | Fase 3 |
| Chat sobre ticket | No | Fase 4 |
| SLA / automations / KB / métricas avanzadas | No | Hardening+ |
| WhatsApp / teléfono | No | Fuera hasta decisión |

Detalle de fases: [ROADMAP.md](./ROADMAP.md). Aceptación MVP: [MVP.md](./MVP.md).
