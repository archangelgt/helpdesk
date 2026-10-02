import { ClientResponseError } from "pocketbase";
import { anyOf, ensureAdminAuth, pb } from "../db/pocketbase.js";
import type {
  CalendarRow,
  HolidayRow,
  TemplateChecklistRow,
  TemplateClientRequestRow,
  TemplateRow,
  TemplateStageDependencyRow,
  TemplateStageRow,
} from "../types/records.js";

export interface TemplateBundle {
  template: TemplateRow;
  stages: TemplateStageRow[];
  dependencies: TemplateStageDependencyRow[];
  checklist: TemplateChecklistRow[];
  requests: TemplateClientRequestRow[];
}

export const templatesModel = {
  async list(typeId?: string): Promise<(TemplateRow & { stageCount: number })[]> {
    await ensureAdminAuth();
    const filter = typeId ? pb.filter("active = true && type = {:typeId}", { typeId }) : "active = true";
    const templates = await pb.collection("templates").getFullList<TemplateRow>({ filter, sort: "name" });
    const stages = templates.length
      ? await pb.collection("template_stages").getFullList<TemplateStageRow>({
          filter: anyOf("template", templates.map((t) => t.id)),
          fields: "id,template",
        })
      : [];
    return templates.map((t) => ({ ...t, stageCount: stages.filter((s) => s.template === t.id).length }));
  },

  async bundle(templateId: string): Promise<TemplateBundle | null> {
    await ensureAdminAuth();
    let template: TemplateRow;
    try {
      template = await pb.collection("templates").getOne<TemplateRow>(templateId);
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
    const stages = await pb.collection("template_stages").getFullList<TemplateStageRow>({
      filter: pb.filter("template = {:id}", { id: templateId }),
      sort: "sort_order",
    });
    const ids = stages.map((s) => s.id);
    const [dependencies, checklist, requests] = await Promise.all([
      ids.length
        ? pb.collection("template_stage_dependencies").getFullList<TemplateStageDependencyRow>({ filter: anyOf("stage", ids) })
        : [],
      ids.length
        ? pb.collection("template_checklist_items").getFullList<TemplateChecklistRow>({ filter: anyOf("stage", ids), sort: "sort_order" })
        : [],
      ids.length
        ? pb.collection("template_client_requests").getFullList<TemplateClientRequestRow>({ filter: anyOf("stage", ids), sort: "sort_order" })
        : [],
    ]);
    return { template, stages, dependencies, checklist, requests };
  },

  async defaultCalendar(): Promise<{ calendar: CalendarRow | null; holidays: string[] }> {
    await ensureAdminAuth();
    const calendars = await pb.collection("business_calendars").getList<CalendarRow>(1, 1, { filter: "is_default = true" });
    const calendar = calendars.items[0] ?? null;
    if (!calendar) return { calendar: null, holidays: [] };
    const holidays = await pb.collection("holidays").getFullList<HolidayRow>({
      filter: pb.filter("calendar = {:id}", { id: calendar.id }),
      fields: "day",
    });
    return { calendar, holidays: holidays.map((h) => h.day.slice(0, 10)) };
  },
};
