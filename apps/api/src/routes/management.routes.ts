import type { FastifyInstance } from "fastify";
import { reportsController } from "../controllers/reports.controller.js";
import { settingsController } from "../controllers/settings.controller.js";
import { usersController } from "../controllers/users.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

/** Nombre, tema e idioma por defecto: los necesita la pantalla de login, antes de iniciar sesión. */
export async function publicSettingsRoutes(app: FastifyInstance) {
  app.get("/settings/public", settingsController.publicSettings);
}

/** Configuración, usuarios y reportes. Los permisos se validan en los services. */
export async function managementRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/settings", settingsController.get);
  app.patch("/settings", settingsController.update);
  app.patch("/settings/sender", settingsController.updateSender);
  app.patch("/settings/rules/:id", settingsController.updateRule);
  app.put("/settings/calendar/working-days", settingsController.setWorkingDays);
  app.post("/settings/calendar/holidays", settingsController.addHoliday);
  app.delete("/settings/calendar/holidays/:id", settingsController.removeHoliday);

  app.get("/users", usersController.list);
  app.get("/users/roles", usersController.roles);
  app.get("/users/:id", usersController.get);
  app.post("/users", usersController.create);
  app.patch("/users/:id", usersController.update);
  app.post("/users/:id/reset-password", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    handler: usersController.resetPassword,
  });

  app.get("/reports/overview", reportsController.overview);
}
