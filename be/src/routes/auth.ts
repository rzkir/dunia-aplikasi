import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { ObjectId } from "mongodb";
import type { Bindings } from "../env";
import { getDb } from "../db";
import { pbkdf2HashPassword, randomBase64Url, timingSafeEqual } from "../crypto";
import { signJwtHS256, verifyJwtHS256 } from "../jwt";
import type { AccountDoc } from "../models";
import { toAccountPublic } from "../models";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const authRoutes = new Hono<{ Bindings: Bindings }>();

const SESSION_COOKIE_NAME = "da_auth_token";

function setSessionCookie(c: any, token: string) {
  const url = new URL(c.req.url);
  const isSecure = url.protocol === "https:";
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

authRoutes.post("/signup", async (c) => {
  const body = await c.req.json().catch(() => null) as
    | { email?: string; password?: string; displayName?: string; phone?: string; namaToko?: string }
    | null;

  const email = normalizeEmail(body?.email || "");
  const password = body?.password || "";
  const displayName = (body?.displayName || "").trim();

  if (!isValidEmail(email)) return c.json({ error: { message: "Email tidak valid", code: "INVALID_EMAIL" } }, 400);
  if (password.length < 8) return c.json({ error: { message: "Password minimal 8 karakter", code: "WEAK_PASSWORD" } }, 400);
  if (!displayName) return c.json({ error: { message: "Display name wajib diisi", code: "MISSING_DISPLAY_NAME" } }, 400);

  const secret = c.env.JWT_SECRET;
  if (!secret) return c.json({ error: { message: "Server misconfigured (JWT_SECRET)" } }, 500);

  const db = await getDb(c.env);
  const accounts = db.collection<AccountDoc>("accounts");

  const exists = await accounts.findOne({ email });
  if (exists) return c.json({ error: { message: "Email sudah terdaftar", code: "EMAIL_TAKEN" } }, 409);

  const now = new Date();
  const passwordSalt = randomBase64Url(16);
  const passwordHash = await pbkdf2HashPassword(password, passwordSalt);

  const doc = {
    email,
    displayName,
    avatar: "",
    passwordSalt,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  } as Omit<AccountDoc, "_id">;

  const result = await accounts.insertOne(doc as AccountDoc);
  const inserted = { ...(doc as AccountDoc), _id: result.insertedId };

  const token = await signJwtHS256(secret, { sub: inserted._id.toHexString(), email }, 60 * 60 * 24 * 7);
  const account = toAccountPublic(inserted);

  setSessionCookie(c, token);
  return c.json({ token, user: account, account });
});

authRoutes.post("/signin", async (c) => {
  const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = normalizeEmail(body?.email || "");
  const password = body?.password || "";

  if (!isValidEmail(email)) return c.json({ error: { message: "Email atau password salah", code: "INVALID_CREDENTIALS" } }, 401);
  if (!password) return c.json({ error: { message: "Email atau password salah", code: "INVALID_CREDENTIALS" } }, 401);

  const secret = c.env.JWT_SECRET;
  if (!secret) return c.json({ error: { message: "Server misconfigured (JWT_SECRET)" } }, 500);

  const db = await getDb(c.env);
  const accounts = db.collection<AccountDoc>("accounts");

  const doc = await accounts.findOne({ email });
  if (!doc) return c.json({ error: { message: "Email atau password salah", code: "INVALID_CREDENTIALS" } }, 401);

  const computed = await pbkdf2HashPassword(password, doc.passwordSalt);
  const ok = await timingSafeEqual(computed, doc.passwordHash);
  if (!ok) return c.json({ error: { message: "Email atau password salah", code: "INVALID_CREDENTIALS" } }, 401);

  const token = await signJwtHS256(secret, { sub: doc._id.toHexString(), email }, 60 * 60 * 24 * 7);
  const account = toAccountPublic(doc);
  setSessionCookie(c, token);
  return c.json({ token, user: account, account });
});

authRoutes.get("/me", async (c) => {
  const auth = c.req.header("Authorization") || "";
  let token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) {
    const cookie = c.req.header("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)da_auth_token=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : "";
  }
  const secret = c.env.JWT_SECRET;
  if (!secret) return c.json({ error: { message: "Server misconfigured (JWT_SECRET)" } }, 500);
  if (!token) return c.json({ error: { message: "Unauthorized" } }, 401);

  const payload = await verifyJwtHS256(secret, token);
  if (!payload?.sub) return c.json({ error: { message: "Unauthorized" } }, 401);

  const db = await getDb(c.env);
  const accounts = db.collection<AccountDoc>("accounts");

  const _id = ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : null;
  if (!_id) return c.json({ error: { message: "Unauthorized" } }, 401);
  const doc = await accounts.findOne({ _id });
  if (!doc) return c.json({ error: { message: "Unauthorized" } }, 401);

  const account = toAccountPublic(doc);
  return c.json({ user: account, account });
});

authRoutes.post("/signout", async (c) => {
  const url = new URL(c.req.url);
  const isSecure = url.protocol === "https:";
  setCookie(c, SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
  return c.json({ ok: true });
});

