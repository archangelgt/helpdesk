#!/usr/bin/env python3
"""Prueba de integración del esquema de PocketBase v2 (solo biblioteca estándar).

Uso: PB_URL=http://127.0.0.1:18199 PB_EMAIL=... PB_PASSWORD=... python3 v2/scripts/test-schema.py
Ejecutar SOLO contra una base desechable: crea y borra datos.
"""
import json
import os
import sys
import urllib.error
import urllib.request

PB = os.environ.get("PB_URL", "http://127.0.0.1:18199")
results = {"ok": 0, "fail": 0}


def call(method, path, body=None, token=None):
    req = urllib.request.Request(PB + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def check(name, condition, detail=""):
    results["ok" if condition else "fail"] += 1
    print(("  OK   " if condition else "  FAIL ") + name + ("" if condition else f"  -> {detail}"))


auth_status, auth = call(
    "POST",
    "/api/collections/_superusers/auth-with-password",
    {"identity": os.environ["PB_EMAIL"], "password": os.environ["PB_PASSWORD"]},
)
T = auth.get("token")
if not T:
    sys.exit(f"No se pudo autenticar: {auth_status} {auth}")


def create(collection, data):
    return call("POST", f"/api/collections/{collection}/records", data, T)


def update(collection, rid, data):
    return call("PATCH", f"/api/collections/{collection}/records/{rid}", data, T)


def get(collection, rid, expand=""):
    return call("GET", f"/api/collections/{collection}/records/{rid}" + (f"?expand={expand}" if expand else ""), None, T)[1]


def items(collection, flt="", sort=""):
    q = urllib.parse.urlencode({"filter": flt, "sort": sort, "perPage": 500})
    return call("GET", f"/api/collections/{collection}/records?{q}", None, T)[1]["items"]


def one(collection, flt):
    found = items(collection, flt)
    assert found, f"Sin resultados en {collection} para {flt}"
    return found[0]


import urllib.parse  # noqa: E402

print("Catálogos de fábrica")
check("7 roles", len(items("roles")) == 7)
check("25 estados en 4 flujos", len(items("statuses")) == 25)
check("3 tipos de caso", len(items("work_item_types")) == 3)
check("plantilla con 6 etapas", len(items("template_stages")) == 6)
check("5 dependencias secuenciales en la plantilla", len(items("template_stage_dependencies")) == 5)
check("7 requerimientos modelo al cliente", len(items("template_client_requests")) == 7)

st = lambda wf, code: one("statuses", f'workflow.code="{wf}" && code="{code}"')["id"]  # noqa: E731
types = {t["code"]: t for t in items("work_item_types")}
role = lambda code: one("roles", f'code="{code}"')["id"]  # noqa: E731

print("Cliente, usuarios y contactos")
s, client = create("clients", {"name": "Cap World (prueba)", "tax_id": "1234567-8", "status": "active"})
check("crear cliente", s == 200, client)
s, other_client = create("clients", {"name": "Otra empresa", "status": "active"})
s, contact = create(
    "users",
    {"email": "contacto@capworld.test", "password": "secret-12345", "passwordConfirm": "secret-12345", "name": "Ana Cliente", "role": role("client_admin"), "client": client["id"]},
)
check("crear usuario del cliente", s == 200, contact)
s, tech = create(
    "users",
    {"email": "tecnico@seraph.test", "password": "secret-12345", "passwordConfirm": "secret-12345", "name": "Luis Técnico", "role": role("technician")},
)
s, outsider = create(
    "users",
    {"email": "otro@otra.test", "password": "secret-12345", "passwordConfirm": "secret-12345", "name": "Otro", "role": role("client_user"), "client": other_client["id"]},
)
s, _ = create("client_contacts", {"client": client["id"], "user": contact["id"], "contact_type": "primary", "receives_notifications": True})
check("contacto del cliente válido", s == 200, _)
s, err = create("client_contacts", {"client": client["id"], "user": outsider["id"], "contact_type": "technical"})
check("rechaza contacto que es usuario de otro cliente", s == 400, err)
s, err = create("clients", {"name": "Duplicado", "tax_id": "1234567-8", "status": "active"})
check("rechaza NIT duplicado", s == 400, err)

print("Implementación desde plantilla")
s, impl = create(
    "work_items",
    {"type": types["implementation"]["id"], "title": "Implementación ERPSYS", "status": st("implementation", "planificada"), "client": client["id"], "requester": contact["id"], "created_by": tech["id"], "assignee": tech["id"]},
)
check("crear implementación", s == 200, impl)
check("número asignado IMP-0001", impl.get("number") == "IMP-0001", impl.get("number"))
check("status_category en caché = new", impl.get("status_category") == "new", impl.get("status_category"))
check("historial inicial", len(items("work_item_status_history", f'work_item="{impl["id"]}"')) == 1)

template = one("templates", 'name="Implementación ERPSYS"')
tstages = items("template_stages", f'template="{template["id"]}"', "sort_order")
stage_ids = {}
for ts in tstages:
    s, stage = create(
        "stages",
        {"work_item": impl["id"], "template_stage": ts["id"], "name": ts["name"], "sort_order": ts["sort_order"], "status": st("stage", "pendiente"), "responsible_side": ts["responsible_side"], "weight": ts["weight"], "client_visible": True},
    )
    stage_ids[ts["id"]] = stage["id"]
check("6 etapas creadas", len(stage_ids) == 6)
for dep in items("template_stage_dependencies"):
    create("stage_dependencies", {"stage": stage_ids[dep["stage"]], "depends_on": stage_ids[dep["depends_on"]], "dependency_type": "finish_to_start"})
check("5 dependencias copiadas", len(items("stage_dependencies")) == 5)

carga = one("stages", f'work_item="{impl["id"]}" && name="Carga de información"')
for tr in items("template_client_requests", f'stage.name="Carga de información"'):
    s, req = create(
        "client_requests",
        {"work_item": impl["id"], "stage": carga["id"], "template_request": tr["id"], "title": tr["title"], "request_type": tr["request_type"], "blocking": tr["blocking"], "status": "pending", "contact": contact["id"], "requested_by": tech["id"]},
    )
check("5 requerimientos al cliente en Carga de información", len(items("client_requests", f'stage="{carga["id"]}"')) == 5)
check("3 son bloqueantes", len(items("client_requests", f'stage="{carga["id"]}" && blocking=true')) == 3)

print("Cambios de estado, historial y avance")
s, impl = update("work_items", impl["id"], {"status": st("implementation", "en_curso"), "updated_by": tech["id"]})
check("implementación en curso", impl.get("status_category") == "in_progress", impl)
hist = items("work_item_status_history", f'work_item="{impl["id"]}"', "-created")
check("historial con 2 cambios y quién cambió", len(hist) == 2 and hist[0]["changed_by"] == tech["id"], hist[:1])

kickoff = one("stages", f'work_item="{impl["id"]}" && name="Kickoff"')
update("stages", kickoff["id"], {"status": st("stage", "completada")})
check("avance 17% al completar 1 de 6 etapas", get("work_items", impl["id"])["progress_percent"] == 17, get("work_items", impl["id"])["progress_percent"])
salida = one("stages", f'work_item="{impl["id"]}" && name="Salida a producción"')
update("stages", salida["id"], {"status": st("stage", "omitida")})
check("avance 20% al omitir una etapa (1 de 5)", get("work_items", impl["id"])["progress_percent"] == 20, get("work_items", impl["id"])["progress_percent"])

print("Soporte: numeración y resolución")
s, t1 = create("work_items", {"type": types["support"]["id"], "title": "No puedo facturar", "status": st("support", "nuevo"), "client": client["id"], "requester": contact["id"]})
s, t2 = create("work_items", {"type": types["support"]["id"], "title": "Error en reporte", "status": st("support", "nuevo"), "client": client["id"], "requester": contact["id"]})
check("numeración por tipo SOP-0001 y SOP-0002", (t1.get("number"), t2.get("number")) == ("SOP-0001", "SOP-0002"), (t1.get("number"), t2.get("number")))
s, t1 = update("work_items", t1["id"], {"status": st("support", "resuelto"), "updated_by": tech["id"]})
check("al resolver guarda resolved_at y resolved_by", bool(t1.get("resolved_at")) and t1.get("resolved_by") == tech["id"], t1)
s, t1 = update("work_items", t1["id"], {"status": st("support", "reabierto"), "updated_by": contact["id"]})
check("al reabrir limpia la resolución", not t1.get("resolved_at") and not t1.get("resolved_by"), t1)

print("Reglas de integridad (deben rechazarse)")
s, err = create("work_items", {"type": types["implementation"]["id"], "title": "x", "status": st("support", "nuevo")})
check("estado de otro flujo", s == 400, err)
s, err = create("stages", {"work_item": t2["id"], "name": "x", "status": st("stage", "pendiente"), "responsible_side": "internal"})
check("etapas en un tipo sin etapas", s == 400, err)
s, err = create("stages", {"work_item": impl["id"], "name": "x", "status": st("support", "nuevo"), "responsible_side": "internal"})
check("etapa con estado que no es del flujo de etapas", s == 400, err)
config = one("stages", f'work_item="{impl["id"]}" && name="Configuración"')
s, err = create("stage_dependencies", {"stage": carga["id"], "depends_on": config["id"], "dependency_type": "finish_to_start"})
check("dependencia circular", s == 400, err)
s, err = create("stage_dependencies", {"stage": carga["id"], "depends_on": carga["id"], "dependency_type": "finish_to_start"})
check("etapa que depende de sí misma", s == 400, err)
s, err = create("client_requests", {"work_item": t2["id"], "stage": carga["id"], "title": "x", "request_type": "document", "status": "pending"})
check("requerimiento con etapa de otro caso", s == 400, err)
s, err = create("comments", {"work_item": t2["id"], "stage": carga["id"], "body": "x", "visibility": "public"})
check("comentario con etapa de otro caso", s == 400, err)
s, err = create("checklist_items", {"work_item": impl["id"], "stage": carga["id"], "title": "x"})
check("checklist con dos dueños", s == 400, err)
s, err = create("checklist_items", {"title": "x"})
check("checklist sin dueño", s == 400, err)
s, err = create("work_items", {"type": types["support"]["id"], "title": "x", "status": st("support", "nuevo"), "client": client["id"], "requester": outsider["id"]})
check("solicitante de otro cliente", s == 400, err)
s, err = create("work_item_links", {"source": t2["id"], "target": t2["id"], "link_type": "relates_to"})
check("caso vinculado consigo mismo", s == 400, err)
s, err = create("priorities", {"code": "urgent", "name": "Urgente", "level": 5, "is_default": True})
check("segunda prioridad por defecto", s == 400, err)
s, err = create("statuses", {"workflow": one("workflows", 'code="support"')["id"], "code": "otro_inicial", "name": "x", "category": "new", "is_initial": True})
check("segundo estado inicial en un flujo", s == 400, err)
s, err = create("external_identities", {"connector": one("connectors", 'code="erpsys"')["id"], "entity": "user", "client": client["id"], "external_id": "1"})
check("identidad externa con entidad incorrecta", s == 400, err)

print("Borrado en cascada")
call("DELETE", f"/api/collections/work_items/records/{impl['id']}", None, T)
check("al borrar el caso se borran etapas, dependencias, requerimientos e historial",
      not items("stages", f'work_item="{impl["id"]}"') and not items("stage_dependencies") and not items("client_requests", f'work_item="{impl["id"]}"') and not items("work_item_status_history", f'work_item="{impl["id"]}"'))

print(f"\nResultado: {results['ok']} OK, {results['fail']} fallos")
sys.exit(1 if results["fail"] else 0)
