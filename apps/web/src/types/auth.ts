import type { Language } from "../i18n";
import type { Mode, Theme } from "../theme/preferences";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: { code: string; name: string; scope: "staff" | "client" } | null;
  client: { id: string; name: string } | null;
  language: Language;
  colorMode: Mode;
  theme: Theme;
  permissions: string[];
}

export interface SessionResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: CurrentUser;
}

export type PreferencesPatch = Partial<Pick<CurrentUser, "language" | "colorMode" | "theme">>;
