import type { Language } from "../config/constants.js";

export type RoleScope = "staff" | "client";
export type UserStatus = "active" | "invited" | "suspended";
export type ColorMode = "light" | "dark" | "system";

export interface Role {
  id: string;
  code: string;
  name: string;
  scope: RoleScope;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  client: string;
  status: UserStatus | "";
  language: Language | "";
  timezone: string;
  color_mode: ColorMode | "";
  theme: string;
  avatar: string;
}

export interface SessionRecord {
  id: string;
  user: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Pick<Role, "code" | "name" | "scope"> | null;
  client: { id: string; name: string } | null;
  language: Language | null;
  colorMode: ColorMode | null;
  theme: string | null;
  permissions: string[];
}
