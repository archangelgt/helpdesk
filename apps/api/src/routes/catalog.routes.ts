import type { FastifyInstance } from "fastify";
import { catalogController } from "../controllers/catalog.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/authorize.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const view = { preHandler: requirePermission("work_item.view") };
  app.get("/work-item-types", { ...view, handler: catalogController.workItemTypes });
  app.get("/statuses", { ...view, handler: catalogController.statuses });
  app.get("/priorities", { ...view, handler: catalogController.priorities });
  app.get("/categories", { ...view, handler: catalogController.categories });
  app.get("/products", { ...view, handler: catalogController.products });
  app.get("/roles", { preHandler: requirePermission("user.manage"), handler: catalogController.roles });
}
