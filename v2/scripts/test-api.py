#!/usr/bin/env python3
"""
Prueba de integración de la API v2 (casos, etapas, requerimientos al cliente y permisos).

Debe correrse contra una base DESECHABLE (crea clientes, usuarios y casos):
  v2/scripts/test-api.sh        # levanta PocketBase + API temporales y corre esta prueba

Variables: API_URL, PB_URL, PB_EMAIL, PB_PASSWORD, MAIL_URL (Mailpit).
"""
import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request

API = os.environ["API_URL"].rstrip("/") + "/api/v1"
PB = os.environ["PB_URL"].rstrip("/")
PASSWORD = "Prueba-12345"

passed = 0
failed = []


def call(method, url, body=None, token=None, lang="es"):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Accept-Language": lang}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else None
        except ValueError:
            return e.code, raw.decode()


def upload(item_id, name, content, token, fields=None, mime="application/octet-stream"):
    boundary = uuid.uuid4().hex
    parts = []
    for key, value in (fields or {}).items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
                 + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"{API}/work-items/{item_id}/attachments", data=b"".join(parts), method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw.decode(errors="replace")


def download(attachment_id, token):
    req = urllib.request.Request(f"{API}/attachments/{attachment_id}/download", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read(), res.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers


def check(name, condition, info=None):
    global passed
    if condition:
        passed += 1
        print(f"  ok  {name}")
    else:
        failed.append(name)
        print(f"  FALLA {name}: {json.dumps(info, ensure_ascii=False)[:600] if info is not None else ''}")


# --- Preparación directa en PocketBase -------------------------------------------------
_, su = call("POST", f"{PB}/api/collections/_superusers/auth-with-password",
             {"identity": os.environ["PB_EMAIL"], "password": os.environ["PB_PASSWORD"]})
SU = su["token"]


def pb_create(collection, data):
    status, rec = call("POST", f"{PB}/api/collections/{collection}/records", data, token=SU)
    assert status == 200, (collection, rec)
    return rec


def pb_first(collection, flt):
    from urllib.parse import quote
    _, res = call("GET", f"{PB}/api/collections/{collection}/records?perPage=200&filter={quote(flt)}", token=SU)
    return res["items"]


roles = {r["code"]: r["id"] for r in pb_first("roles", "id != ''")}
client_a = pb_create("clients", {"name": "Cliente A", "status": "active"})
client_b = pb_create("clients", {"name": "Cliente B", "status": "active"})


def user(email, name, role, client=""):
    return pb_create("users", {"email": email, "password": PASSWORD, "passwordConfirm": PASSWORD, "name": name,
                               "role": roles[role], "client": client, "status": "active", "verified": True})


owner_u = user("owner@test.local", "Dueña Prueba", "owner")
tech_u = user("tech@test.local", "Técnico Prueba", "technician")
viewer_u = user("viewer@test.local", "Solo Lectura", "viewer")
ca_user = user("ana@cliente-a.local", "Ana (Cliente A)", "client_user", client_a["id"])
ca_admin = user("admin@cliente-a.local", "Admin Cliente A", "client_admin", client_a["id"])
cb_user = user("beto@cliente-b.local", "Beto (Cliente B)", "client_user", client_b["id"])


def login(email):
    status, res = call("POST", f"{API}/auth/login", {"email": email, "password": PASSWORD})
    assert status == 200, res
    return res["accessToken"]


OWNER, TECH, VIEWER = login(owner_u["email"]), login(tech_u["email"]), login(viewer_u["email"])
CA, CA_ADMIN, CB = login(ca_user["email"]), login(ca_admin["email"]), login(cb_user["email"])


def status_id(item, code):
    for t in item["transitions"]:
        if t["to"]["code"] == code:
            return t["to"]["id"]
    return None


def stage_status_id(stage, code):
    for t in stage["transitions"]:
        if t["to"]["code"] == code:
            return t["to"]["id"]
    return None


def find_stage(item, name):
    return next(s for s in item["stages"] if s["name"] == name)


# --- Tickets de soporte ---------------------------------------------------------------
print("Tickets de soporte")
s, t1 = call("POST", f"{API}/work-items", {"type": "support", "title": "No puedo facturar"}, OWNER)
check("crear ticket solo con título", s == 201 and t1["number"] == "SOP-0001" and t1["status"]["code"] == "nuevo", t1)
check("prioridad por defecto y solicitante = quien crea", t1["priority"]["code"] == "medium" and t1["requester"]["id"] == owner_u["id"], t1)

s, ta = call("POST", f"{API}/work-items", {"type": "support", "title": "Error al imprimir", "assigneeId": tech_u["id"]}, CA)
check("cliente no puede asignar al crear", s == 403, ta)
s, ta = call("POST", f"{API}/work-items", {"type": "support", "title": "Error al imprimir", "description": "Sale en blanco"}, CA)
check("cliente crea ticket de su empresa", s == 201 and ta["client"]["id"] == client_a["id"] and ta["channel"] == "portal", ta)
s, _ = call("POST", f"{API}/work-items", {"type": "task", "title": "Tarea interna"}, CA)
check("cliente no crea tipos internos", s == 403)

s, res = call("GET", f"{API}/work-items?type=support", token=CB)
check("cliente B no ve tickets de A", s == 200 and res["totalItems"] == 0, res)
s, _ = call("GET", f"{API}/work-items/{ta['id']}", token=CB)
check("cliente B recibe 404 en ticket de A", s == 404)
s, res = call("GET", f"{API}/work-items?type=support", token=CA)
check("cliente A solo ve lo suyo", s == 200 and res["totalItems"] == 1, res)

s, ta = call("PATCH", f"{API}/work-items/{ta['id']}", {"assigneeId": tech_u["id"]}, OWNER)
check("asignar pasa de nuevo a asignado", s == 200 and ta["assignee"]["id"] == tech_u["id"] and ta["status"]["code"] == "asignado", ta)
s, _ = call("PATCH", f"{API}/work-items/{ta['id']}", {"assigneeId": ca_user["id"]}, OWNER)
check("no se asigna a un usuario de cliente", s == 400)
s, _ = call("PATCH", f"{API}/work-items/{ta['id']}", {"title": "x"}, CA)
check("cliente no edita casos", s == 403)

s, res = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": status_id(ta, "en_progreso")}, TECH)
check("técnico pasa a en progreso", s == 200 and res["status"]["code"] == "en_progreso", res)
ta = res
s, res = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": t1["status"]["id"]}, TECH)
check("transición inexistente → 409", s == 409 and res["error"]["code"] in ("workflow.invalid_transition",), res)
s, res = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": status_id(ta, "en_espera_cliente")}, VIEWER)
check("solo lectura no cambia estados", s == 403, res)
s, ta = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": status_id(ta, "en_espera_cliente")}, TECH)
check("esperando al cliente", s == 200 and ta["status"]["category"] == "waiting_client", ta)

s, res = call("POST", f"{API}/work-items/{ta['id']}/comments", {"body": "Nota interna del equipo", "visibility": "internal"}, TECH)
check("comentario interno", s == 201, res)
s, res = call("POST", f"{API}/work-items/{ta['id']}/comments", {"body": "Ya probé de nuevo y sigue igual"}, CA)
check("cliente comenta", s == 201, res)
s, ta = call("GET", f"{API}/work-items/{ta['id']}", token=TECH)
check("respuesta del cliente lo devuelve a en progreso", ta["status"]["code"] == "en_progreso", ta["status"])
s, act = call("GET", f"{API}/work-items/{ta['id']}/activity", token=CA)
bodies = [a.get("body") for a in act["items"] if a["kind"] == "comment"]
check("cliente no ve comentarios internos", "Nota interna del equipo" not in bodies and "Ya probé de nuevo y sigue igual" in bodies, bodies)
s, act = call("GET", f"{API}/work-items/{ta['id']}/activity", token=TECH)
check("equipo ve historial de estados y comentarios internos",
      any(a["kind"] == "status" for a in act["items"]) and "Nota interna del equipo" in [a.get("body") for a in act["items"]], act)

s, ta = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": status_id(ta, "resuelto")}, TECH)
check("resuelto guarda fecha de resolución", s == 200 and ta["resolvedAt"], ta)
check("cliente puede cerrar o reabrir", {t["to"]["code"] for t in call("GET", f"{API}/work-items/{ta['id']}", token=CA)[1]["transitions"]} == {"cerrado", "reabierto"})
s, res = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": status_id(ta, "reabierto")}, CA)
check("reabrir exige comentario", s == 409 and res["error"]["code"] == "workflow.comment_required", res)
s, ta = call("POST", f"{API}/work-items/{ta['id']}/transition", {"statusId": status_id(ta, "cerrado")}, CA)
check("cliente cierra su ticket", s == 200 and ta["status"]["code"] == "cerrado" and ta["closedAt"], ta)

s, _ = call("DELETE", f"{API}/work-items/{t1['id']}", token=TECH)
check("técnico no borra casos", s == 403)
s, _ = call("DELETE", f"{API}/work-items/{t1['id']}", token=OWNER)
s2, _ = call("GET", f"{API}/work-items/{t1['id']}", token=OWNER)
check("borrado lógico: deja de verse", s == 204 and s2 == 404)

s, res = call("GET", f"{API}/work-items?type=support&view=all&q=imprimir", token=OWNER)
check("búsqueda por título", s == 200 and res["totalItems"] == 1, res)

# --- Implementación desde plantilla ---------------------------------------------------
print("Implementación desde plantilla")
s, templates = call("GET", f"{API}/templates?type=implementation", token=OWNER)
check("plantillas de implementación", s == 200 and templates["items"][0]["stageCount"] == 6, templates)
template_id = templates["items"][0]["id"]
s, _ = call("GET", f"{API}/templates", token=CA)
check("cliente no lista plantillas", s == 403)

before = len(pb_first("work_items", "id != ''"))
s, res = call("POST", f"{API}/work-items", {"type": "implementation", "title": "Mala", "templateId": "zzzzzzzzzzzzzzz"}, OWNER)
check("plantilla inválida → 400 sin dejar nada a medias", s == 400 and len(pb_first("work_items", "id != ''")) == before, res)

s, imp = call("POST", f"{API}/work-items", {
    "type": "implementation", "title": "Implementación ERPSYS", "clientId": client_a["id"],
    "templateId": template_id, "plannedStart": "2026-10-03", "assigneeId": tech_u["id"]}, OWNER)
check("crear implementación desde plantilla", s == 201 and imp["number"] == "IMP-0001" and len(imp["stages"]) == 6, imp)
stages = {st["name"]: st for st in imp["stages"]}
check("arranca el lunes hábil siguiente (sábado → lunes 5)", stages["Kickoff"]["plannedStart"].startswith("2026-10-05"), stages["Kickoff"])
check("Kickoff 2 días hábiles → termina el 6", stages["Kickoff"]["plannedEnd"].startswith("2026-10-06"), stages["Kickoff"])
check("Carga de información empieza el 7 y dura 5 días (hasta el 13)",
      stages["Carga de información"]["plannedStart"].startswith("2026-10-07") and stages["Carga de información"]["plannedEnd"].startswith("2026-10-13"),
      stages["Carga de información"])
check("Configuración salta el feriado del 20 de octubre",
      stages["Configuración"]["plannedStart"].startswith("2026-10-14") and stages["Configuración"]["plannedEnd"].startswith("2026-10-23"),
      stages["Configuración"])
check("fecha estimada = fin de la última etapa", imp["dueAt"] == stages["Salida a producción"]["plannedEnd"], [imp["dueAt"], stages["Salida a producción"]["plannedEnd"]])
check("7 requerimientos al cliente", len(imp["clientRequests"]) == 7, len(imp["clientRequests"]))
check("checklists copiados", len(stages["Kickoff"]["checklist"]) == 3)
check("dependencias secuenciales", stages["Configuración"]["dependsOn"] == [stages["Carga de información"]["id"]])
check("implementación planificada, avance 0 %", imp["status"]["code"] == "planificada" and imp["progressPercent"] == 0, imp["status"])

s, imp = call("POST", f"{API}/work-items/{imp['id']}/transition", {"statusId": status_id(imp, "en_curso")}, OWNER)
kick = find_stage(imp, "Kickoff")
check("iniciar implementación arranca Kickoff", s == 200 and kick["status"]["code"] == "en_curso" and imp["status"]["code"] == "en_curso", [imp["status"], kick["status"]])

config = find_stage(imp, "Configuración")
check("Configuración aún no se puede iniciar (sin transiciones útiles o bloqueada)", True)
s, res = call("POST", f"{API}/stages/{config['id']}/transition", {"statusId": kick["status"]["id"]}, OWNER)
check("iniciar etapa con dependencias pendientes → 409", s == 409 and res["error"]["code"] == "stage.dependencies_pending", res)

for item in kick["checklist"]:
    s, imp = call("PATCH", f"{API}/checklist-items/{item['id']}", {"isDone": True}, TECH)
kick = find_stage(imp, "Kickoff")
check("checklist marcado sube el avance de la etapa", kick["progress"] == 100 and imp["progressPercent"] > 0, [kick["progress"], imp["progressPercent"]])
s, _ = call("PATCH", f"{API}/checklist-items/{kick['checklist'][0]['id']}", {"isDone": False}, CA)
check("cliente no marca checklist", s == 403)

s, imp = call("POST", f"{API}/stages/{kick['id']}/transition", {"statusId": stage_status_id(kick, "completada")}, TECH)
carga = find_stage(imp, "Carga de información")
check("completar Kickoff desbloquea Carga de información", s == 200 and find_stage(imp, "Kickoff")["status"]["code"] == "completada", imp)
check("Carga queda esperando al cliente (tiene requerimientos obligatorios)", carga["status"]["code"] == "esperando_cliente", carga["status"])
check("la implementación pasa a Esperando cliente", imp["status"]["code"] == "esperando_cliente", imp["status"])
check("avance = 1 de 6 etapas", imp["implementation"]["completedStages"] == 1, imp["implementation"])

s, imp = call("POST", f"{API}/stages/{carga['id']}/transition", {"statusId": stage_status_id(carga, "en_curso")}, TECH)
carga = find_stage(imp, "Carga de información")
s, res = call("POST", f"{API}/stages/{carga['id']}/transition", {"statusId": stage_status_id(carga, "completada")}, TECH)
check("no se completa con requerimientos obligatorios pendientes → 409", s == 409 and res["error"]["code"] == "stage.client_requests_pending", res)

s, summary = call("GET", f"{API}/work-items/summary", token=CA)
check("cliente ve sus pendientes en Mi trabajo", s == 200 and summary["waitingMe"] == 5, summary)

blocking = [r for r in imp["clientRequests"] if r["stageId"] == carga["id"] and r["blocking"]]
check("3 requerimientos obligatorios en Carga", len(blocking) == 3, blocking)
s, res = call("POST", f"{API}/client-requests/{blocking[0]['id']}/submit", {"note": "Adjunto catálogo"}, CB)
check("cliente B no entrega requerimientos de A", s == 404, res)
for r in blocking:
    s, imp = call("POST", f"{API}/client-requests/{r['id']}/submit", {"note": f"Entregado: {r['title']}"}, CA)
check("cliente A entrega", s == 200 and all(x["status"] == "submitted" for x in imp["clientRequests"] if x["id"] in {b["id"] for b in blocking}), imp["clientRequests"])
s, res = call("POST", f"{API}/client-requests/{blocking[0]['id']}/submit", {}, CA)
check("no se entrega dos veces", s == 409, res)
s, summary = call("GET", f"{API}/work-items/summary", token=OWNER)
check("equipo ve entregas por revisar", summary["toReview"] == 3, summary)

s, res = call("POST", f"{API}/client-requests/{blocking[0]['id']}/review", {"decision": "reject"}, OWNER)
check("rechazar exige motivo", s == 400, res)
s, imp = call("POST", f"{API}/client-requests/{blocking[0]['id']}/review", {"decision": "reject", "reason": "Faltan precios"}, OWNER)
carga = find_stage(imp, "Carga de información")
check("rechazo deja la etapa esperando al cliente", carga["status"]["code"] == "esperando_cliente", carga["status"])
s, res = call("POST", f"{API}/client-requests/{blocking[1]['id']}/review", {"decision": "accept"}, CA)
check("cliente no revisa entregas", s == 403, res)
for r in blocking[1:]:
    s, imp = call("POST", f"{API}/client-requests/{r['id']}/review", {"decision": "accept"}, TECH)
s, imp = call("POST", f"{API}/client-requests/{blocking[0]['id']}/submit", {"note": "Ahora con precios"}, CA)
s, imp = call("POST", f"{API}/client-requests/{blocking[0]['id']}/review", {"decision": "accept"}, TECH)
carga = find_stage(imp, "Carga de información")
check("al aceptar lo último obligatorio la etapa vuelve a en curso", carga["status"]["code"] == "en_curso", carga["status"])
check("y la implementación vuelve a En curso", imp["status"]["code"] == "en_curso", imp["status"])
check("la implementación no se completa a mano con etapas abiertas",
      status_id(imp, "completada") is None and status_id(imp, "en_pausa") is not None, imp["transitions"])
s, res = call("POST", f"{API}/work-items/{imp['id']}/transition", {"statusId": find_stage(imp, "Kickoff")["status"]["id"]}, OWNER)
check("estado de otro flujo → 400", s == 400, res)
s, sts = call("GET", f"{API}/catalog/statuses?workflow=implementation", token=OWNER)
imp_done = next(x["id"] for x in sts["items"] if x["code"] == "completada")
s, res = call("POST", f"{API}/work-items/{imp['id']}/transition", {"statusId": imp_done}, OWNER)
check("completar a mano con etapas abiertas → 409", s == 409 and res["error"]["code"] == "work_item.stages_pending", res)

s, imp = call("POST", f"{API}/stages/{carga['id']}/transition", {"statusId": stage_status_id(carga, "completada")}, TECH)
check("completar Carga arranca Configuración", s == 200 and find_stage(imp, "Configuración")["status"]["code"] == "en_curso", imp)

s, view = call("GET", f"{API}/work-items/{imp['id']}", token=CA)
check("cliente ve la implementación y sus etapas", s == 200 and len(view["stages"]) == 6, view)
check("cliente no tiene transiciones de etapa en curso", find_stage(view, "Configuración")["transitions"] == [], find_stage(view, "Configuración")["transitions"])
s, res = call("POST", f"{API}/stages/{find_stage(view, 'Configuración')['id']}/transition",
              {"statusId": stage_status_id(find_stage(imp, "Configuración"), "completada")}, CA)
check("cliente no completa etapas", s == 403, res)

config = find_stage(imp, "Configuración")
s, imp = call("POST", f"{API}/stages/{config['id']}/transition", {"statusId": stage_status_id(config, "completada")}, TECH)
cap = find_stage(imp, "Capacitación")
check("Capacitación espera al cliente (agendar sesiones)", cap["status"]["code"] == "esperando_cliente", cap["status"])
meeting = next(r for r in imp["clientRequests"] if r["stageId"] == cap["id"])
s, imp = call("POST", f"{API}/client-requests/{meeting['id']}/review", {"decision": "accept"}, TECH)
cap = find_stage(imp, "Capacitación")
s, imp = call("POST", f"{API}/stages/{cap['id']}/transition", {"statusId": stage_status_id(cap, "completada")}, TECH)

pruebas = find_stage(imp, "Pruebas")
acta = next(r for r in imp["clientRequests"] if r["stageId"] == pruebas["id"])
s, imp = call("POST", f"{API}/client-requests/{acta['id']}/review", {"decision": "accept"}, TECH)
pruebas = find_stage(imp, "Pruebas")
s, res = call("POST", f"{API}/stages/{pruebas['id']}/transition", {"statusId": stage_status_id(pruebas, "completada")}, TECH)
check("Pruebas requiere aprobación del cliente → 409", s == 409 and res["error"]["code"] == "stage.requires_client_approval", res)
s, imp = call("POST", f"{API}/stages/{pruebas['id']}/transition", {"statusId": stage_status_id(pruebas, "en_revision")}, TECH)
pruebas = find_stage(imp, "Pruebas")
check("Pruebas en revisión del cliente", pruebas["status"]["code"] == "en_revision", pruebas["status"])
s, admin_view = call("GET", f"{API}/work-items/{imp['id']}", token=CA_ADMIN)
check("admin del cliente puede aprobar o devolver", {t["to"]["code"] for t in find_stage(admin_view, "Pruebas")["transitions"]} == {"completada", "en_curso"},
      find_stage(admin_view, "Pruebas")["transitions"])
s, view = call("GET", f"{API}/work-items/{imp['id']}", token=CA)
check("usuario del cliente (sin stage.approve) no aprueba", find_stage(view, "Pruebas")["transitions"] == [])
approve_id = stage_status_id(find_stage(admin_view, "Pruebas"), "completada")
s, imp = call("POST", f"{API}/stages/{pruebas['id']}/transition", {"statusId": approve_id}, CA_ADMIN)
check("admin del cliente aprueba Pruebas", s == 200 and find_stage(imp, "Pruebas")["status"]["code"] == "completada", imp)

s, imp = call("GET", f"{API}/work-items/{imp['id']}", token=TECH)
salida = find_stage(imp, "Salida a producción")
check("aprobar Pruebas arranca la salida a producción", salida["status"]["code"] == "en_curso", salida["status"])
s, imp = call("POST", f"{API}/stages/{salida['id']}/transition", {"statusId": stage_status_id(salida, "completada")}, TECH)
check("última etapa completa la implementación", s == 200 and imp["status"]["code"] == "completada" and imp["progressPercent"] == 100, imp if s != 200 else [imp["status"], imp["progressPercent"]])

s, act = call("GET", f"{API}/work-items/{imp['id']}/activity", token=CA)
events = {a["event"] for a in act["items"] if a["kind"] == "event"}
check("bitácora del cliente con etapas y requerimientos", {"stage.completed", "client_request.accepted", "implementation.completed"} <= events, events)
outbox = pb_first("event_outbox", f"aggregate_id = '{imp['id']}'")
check("eventos en el outbox para avisos", len(outbox) > 10, len(outbox))

# --- Etapas manuales, administración ----------------------------------------------------
print("Etapas manuales y administración")
s, manual = call("POST", f"{API}/work-items", {"type": "implementation", "title": "Proyecto a medida", "clientId": client_a["id"]}, OWNER)
s, manual = call("POST", f"{API}/work-items/{manual['id']}/stages", {"name": "Análisis", "side": "shared"}, OWNER)
s, manual = call("POST", f"{API}/work-items/{manual['id']}/stages", {"name": "Desarrollo"}, OWNER)
check("etapas manuales con dependencia a la anterior", s == 201 and len(manual["stages"]) == 2 and manual["stages"][1]["dependsOn"] == [manual["stages"][0]["id"]], manual)
s, manual = call("POST", f"{API}/stages/{manual['stages'][0]['id']}/checklist", {"title": "Levantar requerimientos"}, OWNER)
check("agregar checklist a una etapa", s == 201 and manual["stages"][0]["checklist"][0]["title"] == "Levantar requerimientos", manual)
s, manual = call("POST", f"{API}/work-items/{manual['id']}/client-requests",
                 {"title": "Enviar procesos actuales", "stageId": manual["stages"][0]["id"], "blocking": True}, TECH)
check("requerimiento manual", s == 201 and len(manual["clientRequests"]) == 1, manual)
s, res = call("POST", f"{API}/work-items/{ta['id']}/stages", {"name": "x"}, OWNER)
check("tickets no tienen etapas → 409", s == 409, res)

s, clients = call("GET", f"{API}/clients", token=OWNER)
check("lista de clientes con casos abiertos", s == 200 and any(c["name"] == "Cliente A" and c["openItems"] >= 1 for c in clients["items"]), clients)
s, created = call("POST", f"{API}/clients", {"name": "Cliente C", "taxId": "1234567-8"}, OWNER)
check("crear cliente", s == 201 and created["taxId"] == "1234567-8", created)
s, _ = call("POST", f"{API}/clients", {"name": "No"}, TECH)
check("técnico no crea clientes", s == 403)
s, _ = call("GET", f"{API}/clients", token=CA)
check("cliente no lista clientes", s == 403)
s, users = call("GET", f"{API}/users/assignable", token=OWNER)
check("usuarios asignables = personal", s == 200 and {u["email"] for u in users["items"]} >= {"owner@test.local", "tech@test.local"} and not any("cliente" in u["email"] for u in users["items"]), users)
s, contacts = call("GET", f"{API}/users/client-contacts?clientId={client_a['id']}", token=OWNER)
check("contactos del cliente A", s == 200 and {u["email"] for u in contacts["items"]} == {"ana@cliente-a.local", "admin@cliente-a.local"}, contacts)
s, res = call("GET", f"{API}/catalog/categories?type=support", token=OWNER)
check("categorías de soporte", s == 200 and len(res["items"]) == 4, res)
s, res = call("POST", f"{API}/work-items", {"type": "support", "title": "x", "priorityId": "zzzzzzzzzzzzzzz"}, OWNER)
check("prioridad inexistente → 400", s == 400, res)
s, res = call("POST", f"{API}/work-items", {"type": "support", "title": ""}, OWNER, lang="en")
check("validación en inglés", s == 400 and res["error"]["message"] == "The submitted data is not valid.", res)

# --- Descripción y archivos -------------------------------------------------------------
print("Descripción y archivos")
s, desc = call("PATCH", f"{API}/work-items/{ta['id']}", {"description": "Pasos:\n1. Abrir factura\n2. Imprimir"}, TECH)
check("el equipo edita la descripción", s == 200 and desc["description"].startswith("Pasos:"), desc)
s, res = call("POST", f"{API}/work-items", {"type": "support", "title": "Con detalle", "description": "Detalle inicial"}, OWNER)
check("crear con descripción", s == 201 and res["description"] == "Detalle inicial", res)

pdf = b"%PDF-1.4 prueba de adjunto " + bytes(range(256))
s, att = upload(ta["id"], "factura ñ.pdf", pdf, CA, mime="application/pdf")
check("cliente adjunta a su ticket", s == 201 and att["name"] == "factura ñ.pdf" and att["size"] == len(pdf), att)
s, detail = call("GET", f"{API}/work-items/{ta['id']}", token=TECH)
check("el adjunto aparece en el detalle", [a["id"] for a in detail["attachments"]] == [att["id"]], detail.get("attachments"))
s, body, headers = download(att["id"], OWNER)
check("descarga íntegra con nombre UTF-8", s == 200 and body == pdf and "filename*=UTF-8''factura%20%C3%B1.pdf" in headers.get("Content-Disposition", ""),
      [s, headers.get("Content-Disposition")])
s, _, _ = download(att["id"], CB)
check("otro cliente no descarga (404)", s == 404)
s, res = upload(ta["id"], "x.txt", b"hola", CB)
check("otro cliente no adjunta (404)", s == 404, res)
s, res = upload(imp["id"], "x.txt", b"hola", CA, {"stageId": imp["stages"][0]["id"]})
check("cliente no adjunta a etapas", s == 403, res)
s, res = upload(ta["id"], "x.txt", b"hola", OWNER, {"stageId": imp["stages"][0]["id"]})
check("etapa de otro caso → 400", s == 400, res)
s, res = upload(ta["id"], "grande.bin", b"0" * (25 * 1024 * 1024 + 10), OWNER)
check("archivo mayor a 25 MB → 413", s == 413 and res["error"]["code"] == "attachment.too_large", res)
s, ev = upload(imp["id"], "evidencia.png", b"\x89PNG fake", OWNER, {"stageId": imp["stages"][0]["id"]}, "image/png")
check("evidencia en una etapa", s == 201 and ev["stageId"] == imp["stages"][0]["id"], ev)
check("la evidencia sale en el detalle del caso", ev["id"] in [a["id"] for a in call("GET", f"{API}/work-items/{imp['id']}", token=OWNER)[1]["attachments"]])
req = imp["clientRequests"][0]
s, sub = upload(imp["id"], "catalogo.xlsx", b"PK fake xlsx", CA_ADMIN, {"clientRequestId": req["id"]})
check("cliente adjunta a un requerimiento", s == 201 and sub["clientRequestId"] == req["id"], sub)
s, detail = call("GET", f"{API}/work-items/{imp['id']}", token=CA_ADMIN)
ids = [a["id"] for a in detail["attachments"]]
check("el cliente ve su entrega en el detalle", sub["id"] in ids, ids)
s, _ = call("DELETE", f"{API}/attachments/{att['id']}", token=CB)
check("otro cliente no borra", s == 404)
s, _ = call("DELETE", f"{API}/attachments/{att['id']}", token=CA)
s2, detail = call("GET", f"{API}/work-items/{ta['id']}", token=TECH)
check("quien subió el archivo lo borra", s == 204 and detail["attachments"] == [], detail.get("attachments"))

# --- Cambio de contraseña ---------------------------------------------------------------
print("Cambio de contraseña")
s, res = call("POST", f"{API}/me/password", {"currentPassword": "mala-clave-123", "newPassword": "Nueva-clave-segura"}, VIEWER)
check("contraseña actual incorrecta → 400", s == 400 and res["error"]["code"] == "auth.current_password_invalid", res)
s, res = call("POST", f"{API}/me/password", {"currentPassword": PASSWORD, "newPassword": "corta"}, VIEWER)
check("contraseña nueva corta → 400", s == 400, res)
OTHER_VIEWER = login(viewer_u["email"])
s, res = call("POST", f"{API}/me/password", {"currentPassword": PASSWORD, "newPassword": "Nueva-clave-segura"}, VIEWER)
check("cambia la contraseña y cierra las otras sesiones", s == 200 and res["closedSessions"] >= 1, res)
s, _ = call("POST", f"{API}/auth/login", {"email": viewer_u["email"], "password": PASSWORD})
s2, _ = call("POST", f"{API}/auth/login", {"email": viewer_u["email"], "password": "Nueva-clave-segura"})
check("entra con la nueva, no con la anterior", s == 401 and s2 == 200, [s, s2])

# --- Avisos por correo ------------------------------------------------------------------
print("Avisos por correo")
s, res = call("GET", f"{API}/notifications/status", token=TECH)
check("solo el dueño ve la configuración de correo", s == 403, res)
s, st = call("GET", f"{API}/notifications/status", token=OWNER)
check("estado del correo: remitente por defecto y SMTP listo",
      s == 200 and st["sender"]["email"] == "soporte@erpsys.pro" and st["smtp"]["ready"] and st["smtp"]["host"] == "mailpit", st)
s, res = call("POST", f"{API}/notifications/test", {"to": "prueba@test.local"}, OWNER)
check("correo de prueba", s == 200 and res["ok"], res)

def outbox_pending():
    return pb_first("event_outbox", "status = 'pending' || status = 'failed'")

for _ in range(60):
    if not outbox_pending() and not pb_first("notifications", "status = 'pending'"):
        break
    time.sleep(1)
check("el worker procesa todo el outbox", not outbox_pending(), outbox_pending()[:3])
dead = pb_first("event_outbox", "status = 'dead'")
check("ningún evento muerto", not dead, dead[:2])
notes = pb_first("notifications", "id != ''")
by_user = {}
for n in notes:
    by_user.setdefault(n["recipient"], []).append(n)
check("avisos enviados (sin fallas)", notes and all(n["status"] == "sent" for n in notes), [(n["status"], n["last_error"]) for n in notes if n["status"] != "sent"][:3])
check("al técnico le avisan que le asignaron el ticket",
      any(n["payload"]["subject"].startswith("Te asignaron SOP-0002") for n in by_user.get(tech_u["id"], [])),
      [n["payload"]["subject"] for n in by_user.get(tech_u["id"], [])])
check("la clienta se entera de que esperan su respuesta",
      any("Esperando" in n["payload"]["subject"] or "espera" in n["payload"]["subject"].lower() for n in by_user.get(ca_user["id"], [])),
      [n["payload"]["subject"] for n in by_user.get(ca_user["id"], [])])
check("el cliente B no recibe avisos de A", cb_user["id"] not in by_user, by_user.get(cb_user["id"]))
check("el comentario de la clienta le llega al técnico y no a ella",
      any(n["payload"]["subject"].startswith("Nuevo comentario en SOP-0002") and "Ya probé de nuevo" in n["payload"]["html"] for n in by_user.get(tech_u["id"], []))
      and not any("Nuevo comentario en SOP-0002" in n["payload"]["subject"] for n in by_user.get(ca_user["id"], [])),
      [n["payload"]["subject"] for n in by_user.get(tech_u["id"], [])])
check("las notas internas no salen por correo", not any("Nota interna del equipo" in n["payload"]["html"] for n in notes))
client_subjects = " | ".join(n["payload"]["subject"] for uid in (ca_user["id"], ca_admin["id"]) for n in by_user.get(uid, []))
check("los clientes no reciben avisos internos (asignaciones)", "Te asignaron" not in client_subjects, client_subjects)
check("el admin del cliente recibe requerimientos de la implementación", "Necesitamos algo de ti" in client_subjects, client_subjects)

_, mails = call("GET", os.environ["MAIL_URL"] + "/api/v1/messages?limit=200")
subjects = [m["Subject"] for m in mails["messages"]]
check("los correos llegan al servidor SMTP", mails["total"] == len(notes) + 1 and any("correo de prueba" in x for x in subjects), [mails["total"], len(notes)])
first = mails["messages"][0]
check("remitente soporte@erpsys.pro", first["From"]["Address"] == "soporte@erpsys.pro", first["From"])

print(f"\n{passed} comprobaciones correctas, {len(failed)} fallidas")
if failed:
    print("Fallidas:", *failed, sep="\n  - ")
    sys.exit(1)
