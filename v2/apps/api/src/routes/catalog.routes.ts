import type { FastifyInstance } from "fastify";
import { catalogController } from "../controllers/catalog.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/authorize.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.get("/work-item-types", { preHandler: requirePermission("work_item.view"), handler: catalogController.workItemTypes });
  app.get("/statuses", { preHandler: requirePermission("work_item.view"), handler: catalogController.statuses });
  app.get("/priorities", { preHandler: requirePermission("work_item.view"), handler: catalogController.priorities });
  app.get("/roles", { preHandler: requirePermission("user.manage"), handler: catalogController.roles });
}
