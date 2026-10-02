export interface AccessTokenClaims {
  sub: string;
  sid: string;
  role: string;
  roleId: string;
  client: string | null;
}

export interface AuthContext {
  userId: string;
  sessionId: string;
  roleCode: string;
  roleId: string;
  clientId: string | null;
}

export interface RequestMeta {
  ip: string;
  userAgent: string;
}
