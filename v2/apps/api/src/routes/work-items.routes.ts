import type { FastifyInstance } from "fastify";
import {
  clientRequestsController,
  stagesController,
  workItemsController,
} from "../controllers/work-items.controller.js";
import { attachmentsController } from "../controllers/attachments.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/authorize.js";

/** Casos (tickets, tareas, implementaciones) y su trabajo. Los permisos finos se validan en los services. */
export async function workItemsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requirePermission("work_item.view"));

  app.get("/work-items", workItemsController.list);
  app.get("/work-items/summary", workItemsController.summary);
  app.post("/work-items", workItemsController.create);
  app.get("/work-items/:id", workItemsController.get);
  app.patch("/work-items/:id", workItemsController.update);
  app.delete("/work-items/:id", workItemsController.remove);
  app.post("/work-items/:id/transition", workItemsController.transition);
  app.get("/work-items/:id/activity", workItemsController.activity);
  app.post("/work-items/:id/comments", workItemsController.addComment);
  app.post("/work-items/:id/stages", workItemsController.addStage);
  app.post("/work-items/:id/checklist", workItemsController.addChecklistItem);
  app.post("/work-items/:id/client-requests", workItemsController.addClientRequest);

  app.patch("/stages/:id", stagesController.update);
  app.post("/stages/:id/transition", stagesController.transition);
  app.post("/stages/:id/checklist", stagesController.addChecklistItem);
  app.patch("/checklist-items/:id", stagesController.updateChecklistItem);

  app.post("/client-requests/:id/submit", clientRequestsController.submit);
  app.post("/client-requests/:id/review", clientRequestsController.review);

  app.post("/work-items/:id/attachments", attachmentsController.upload);
  app.get("/attachments/:id/download", attachmentsController.download);
  app.delete("/attachments/:id", attachmentsController.remove);
}
