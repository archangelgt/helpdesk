import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { exportJWK, jwtVerify, SignJWT, type JWK } from "jose";
import { env } from "../config/env.js";
import type { AccessTokenClaims } from "../types/auth.js";
import { sha256 } from "../utils/crypto.js";
import { Errors } from "../utils/errors.js";

const ALG = "EdDSA";
const AUDIENCE = "helpdesk-v2-api";

const privateKey: KeyObject = createPrivateKey(Buffer.from(env.JWT_PRIVATE_KEY, "base64").toString("utf8"));
const publicKey: KeyObject = createPublicKey(privateKey);
const kid = sha256(publicKey.export({ type: "spki", format: "der" }).toString("base64")).slice(0, 16);

export const tokenService = {
  async signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const token = await new SignJWT({ sid: claims.sid, role: claims.role, roleId: claims.roleId, client: claims.client })
      .setProtectedHeader({ alg: ALG, kid })
      .setSubject(claims.sub)
      .setIssuer(env.JWT_ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey);
    return { token, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS };
  },

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, publicKey, { issuer: env.JWT_ISSUER, audience: AUDIENCE, algorithms: [ALG] });
      if (!payload.sub || typeof payload.sid !== "string" || typeof payload.roleId !== "string") throw new Error("claims");
      return {
        sub: payload.sub,
        sid: payload.sid,
        role: String(payload.role ?? ""),
        roleId: payload.roleId,
        client: typeof payload.client === "string" && payload.client ? payload.client : null,
      };
    } catch {
      throw Errors.unauthorized();
    }
  },

  /** Clave pública para que otros servicios (conectores, widget) validen los tokens. */
  async jwks(): Promise<{ keys: JWK[] }> {
    const jwk = await exportJWK(publicKey);
    return { keys: [{ ...jwk, kid, alg: ALG, use: "sig" }] };
  },
};
