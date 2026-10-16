import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../config/constants.js";
import { CLIENT_REQUEST_TYPES } from "../types/records.js";

export const recordId = z.string().regex(/^[a-z0-9]{15}$/);
/** Fecha de calendario (YYYY-MM-DD). */
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalId = recordId.optional().nullable();
const text = (max: number) => z.string().trim().max(max);

export const idParamSchema = z.object({ id: recordId });

export const WORK_ITEM_VIEWS = ["open", "waiting_client", "done", "all"] as const;

export const listWorkItemsSchema = z.object({
  type: z.string().regex(/^[a-z0-9_]+$/).max(60).optional(),
  view: z.enum(WORK_ITEM_VIEWS).default("open"),
  statusId: recordId.optional(),
  assignee: z.union([z.literal("me"), z.literal("none"), recordId]).optional(),
  clientId: recordId.optional(),
  q: text(120).optional(),
  sort: z.enum(["-created", "created", "-updated", "due_at", "-due_at", "number", "-number"]).default("-created"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ListWorkItemsInput = z.infer<typeof listWorkItemsSchema>;

const planKey = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

export const planStageSchema = z
  .object({
    key: planKey,
    templateStageId: recordId.optional(),
    name: text(120).min(1),
    description: text(2_000).default(""),
    side: z.enum(["internal", "client", "shared"]).default("internal"),
    durationDays: z.number().int().min(1).max(365),
    dependsOn: z.array(planKey).max(20).default([]),
    weight: z.number().int().min(1).max(100).default(1),
    clientVisible: z.boolean().default(true),
    requiresEvidence: z.boolean().default(false),
    requiresClientApproval: z.boolean().default(false),
    ownerId: optionalId,
    checklist: z.array(text(200).min(1)).max(50).default([]),
    requests: z
      .array(
        z
          .object({
            templateRequestId: recordId.optional(),
            title: text(200).min(1),
            description: text(5_000).default(""),
            type: z.enum(CLIENT_REQUEST_TYPES).default("information"),
            dueInDays: z.number().int().min(0).max(365).default(0),
            blocking: z.boolean().default(true),
          })
          .strict(),
      )
      .max(30)
      .default([]),
  })
  .strict();
export type PlanStageInput = z.infer<typeof planStageSchema>;

const planSchema = z.object({ stages: z.array(planStageSchema).min(1).max(40) }).strict();

/** Vista previa del asistente: fechas de un plan, o el plan de una plantilla para editarlo. */
export const planPreviewSchema = z
  .object({
    startDay: day.optional(),
    templateId: recordId.optional(),
    plan: planSchema.optional(),
  })
  .strict()
  .refine((v) => v.templateId || v.plan, { message: "templateId_or_plan" });
export type PlanPreviewInput = z.infer<typeof planPreviewSchema>;

export const createWorkItemSchema = z
  .object({
    type: z.string().regex(/^[a-z0-9_]+$/).max(60),
    title: text(200).min(1),
    description: text(20_000).optional(),
    priorityId: optionalId,
    categoryId: optionalId,
    productId: optionalId,
    clientId: optionalId,
    requesterId: optionalId,
    assigneeId: optionalId,
    parentId: optionalId,
    dueAt: day.optional().nullable(),
    templateId: optionalId,
    plannedStart: day.optional().nullable(),
    plan: planSchema.optional(),
  })
  .strict();
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;

export const updateWorkItemSchema = z
  .object({
    title: text(200).min(1).optional(),
    description: text(20_000).optional(),
    priorityId: optionalId,
    categoryId: optionalId,
    productId: optionalId,
    clientId: optionalId,
    assigneeId: optionalId,
    dueAt: day.optional().nullable(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;

export const transitionSchema = z
  .object({
    statusId: recordId,
    comment: text(5_000).optional(),
  })
  .strict();
export type TransitionInput = z.infer<typeof transitionSchema>;

export const commentSchema = z
  .object({
    body: text(10_000).min(1),
    visibility: z.enum(["public", "internal"]).default("public"),
    stageId: recordId.optional(),
    clientRequestId: recordId.optional(),
  })
  .strict();
export type CommentInput = z.infer<typeof commentSchema>;

export const createStageSchema = z
  .object({
    name: text(120).min(1),
    description: text(2_000).optional(),
    side: z.enum(["internal", "client", "shared"]).default("internal"),
    ownerId: optionalId,
    plannedStart: day.optional().nullable(),
    plannedEnd: day.optional().nullable(),
    weight: z.number().int().min(1).max(100).optional(),
    dependsOnPrevious: z.boolean().default(true),
  })
  .strict();
export type CreateStageInput = z.infer<typeof createStageSchema>;

export const updateStageSchema = z
  .object({
    name: text(120).min(1).optional(),
    description: text(2_000).optional(),
    ownerId: optionalId,
    plannedStart: day.optional().nullable(),
    plannedEnd: day.optional().nullable(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

export const checklistCreateSchema = z.object({ title: text(200).min(1) }).strict();
export const checklistUpdateSchema = z
  .object({ isDone: z.boolean().optional(), title: text(200).min(1).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type ChecklistUpdateInput = z.infer<typeof checklistUpdateSchema>;

export const createClientRequestSchema = z
  .object({
    title: text(200).min(1),
    description: text(5_000).optional(),
    type: z.enum(CLIENT_REQUEST_TYPES).default("information"),
    stageId: optionalId,
    dueAt: day.optional().nullable(),
    blocking: z.boolean().default(false),
  })
  .strict();
export type CreateClientRequestInput = z.infer<typeof createClientRequestSchema>;

export const uploadTargetSchema = z.object({ stageId: recordId.optional(), clientRequestId: recordId.optional() });

export const listClientRequestsSchema = z.object({ view: z.enum(["open", "review"]).default("open") }).strict();
export const submitClientRequestSchema = z.object({ note: text(5_000).optional() }).strict();
export const reviewClientRequestSchema = z
  .object({
    decision: z.enum(["accept", "reject"]),
    reason: text(2_000).optional(),
  })
  .strict()
  .refine((v) => v.decision === "accept" || !!v.reason, { path: ["reason"], message: "Required" });
export type ReviewClientRequestInput = z.infer<typeof reviewClientRequestSchema>;
