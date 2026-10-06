import type { FastifyInstance } from "fastify";
import { healthController } from "../controllers/health.controller.js";
import { adminRoutes } from "./admin.routes.js";
import { authRoutes } from "./auth.routes.js";
import { catalogRoutes } from "./catalog.routes.js";
import { meRoutes } from "./me.routes.js";
import { workItemsRoutes } from "./work-items.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", healthController.check);

  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: "/auth" });
      await v1.register(meRoutes, { prefix: "/me" });
      await v1.register(catalogRoutes, { prefix: "/catalog" });
      await v1.register(workItemsRoutes);
      await v1.register(adminRoutes);
    },
    { prefix: "/api/v1" },
  );
}
