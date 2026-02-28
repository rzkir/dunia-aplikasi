import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { Bindings } from "../env";
import { verifyJwtHS256 } from "../jwt";

export type AuthContextVars = {
  userId: string;
  email?: string;
};

const SESSION_COOKIE_NAME = "da_auth_token";

export function requireAuth(): MiddlewareHandler<{ Bindings: Bindings; Variables: AuthContextVars }> {
  return async (c, next) => {
    const auth = c.req.header("Authorization") || "";
    let token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (!token) {
      token = getCookie(c, SESSION_COOKIE_NAME) || "";
    }
    const secret = c.env.JWT_SECRET;
    if (!secret) return c.json({ error: { message: "Server misconfigured (JWT_SECRET)" } }, 500);
    if (!token) return c.json({ error: { message: "Unauthorized" } }, 401);

    const payload = await verifyJwtHS256(secret, token);
    if (!payload?.sub) return c.json({ error: { message: "Unauthorized" } }, 401);

    c.set("userId", payload.sub);
    if (payload.email) c.set("email", payload.email);
    await next();
  };
}

export function getAuthedUserId(c: { get: (key: "userId") => string }): string {
  return c.get("userId");
}

