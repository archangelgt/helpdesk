import type { RecordModel } from "pocketbase";
import { ensureAdminAuth, pb } from "../db/pocketbase.js";
import type { Role } from "../types/domain.js";

interface RolePermissionRecord extends RecordModel {
  expand?: { permission?: { code: string } };
}

export const rolesModel = {
  async findById(id: string): Promise<Role | null> {
    if (!id) return null;
    await ensureAdminAuth();
    try {
      return await pb.collection("roles").getOne<Role & RecordModel>(id, { fields: "id,code,name,scope" });
    } catch {
      return null;
    }
  },

  async list(): Promise<Role[]> {
    await ensureAdminAuth();
    return pb.collection("roles").getFullList<Role & RecordModel>({ filter: "active = true", sort: "scope,code", fields: "id,code,name,scope" });
  },

  async permissionCodes(roleId: string): Promise<string[]> {
    await ensureAdminAuth();
    const rows = await pb.collection("role_permissions").getFullList<RolePermissionRecord>({
      filter: pb.filter("role = {:roleId}", { roleId }),
      expand: "permission",
      fields: "expand.permission.code",
    });
    return rows.map((r) => r.expand?.permission?.code).filter((c): c is string => !!c).sort();
  },
};
