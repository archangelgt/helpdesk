import type { FastifyInstance } from "fastify";
import { adminController } from "../controllers/admin.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

/** Clientes, usuarios asignables y plantillas. Los permisos se validan en los services. */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/clients", adminController.listClients);
  app.post("/clients", adminController.createClient);
  app.patch("/clients/:id", adminController.updateClient);
  app.get("/users/assignable", adminController.assignableUsers);
  app.get("/users/client-contacts", adminController.clientContacts);
  app.get("/templates", adminController.templates);
}
