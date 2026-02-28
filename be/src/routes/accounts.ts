import { Hono } from "hono";
import { ObjectId } from "mongodb";
import type { Bindings } from "../env";
import { getDb } from "../db";
import type { AccountDoc } from "../models";
import { toAccountPublic } from "../models";
import { requireAuth, getAuthedUserId } from "../middleware/auth";

export const accountsRoutes = new Hono<{ Bindings: Bindings }>();

accountsRoutes.get("/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const authed = getAuthedUserId(c);
  if (id !== authed) return c.json({ error: { message: "Forbidden" } }, 403);

  const _id = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!_id) return c.json({ error: { message: "Not found" } }, 404);

  const db = await getDb(c.env);
  const accounts = db.collection<AccountDoc>("accounts");
  const doc = await accounts.findOne({ _id });
  if (!doc) return c.json({ error: { message: "Not found" } }, 404);

  return c.json(toAccountPublic(doc));
});

accountsRoutes.patch("/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const authed = getAuthedUserId(c);
  if (id !== authed) return c.json({ error: { message: "Forbidden" } }, 403);

  const _id = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!_id) return c.json({ error: { message: "Not found" } }, 404);

  const body = (await c.req.json().catch(() => null)) as Partial<{
    displayName: string;
    avatar: string;
    email: string;
  }> | null;

  const updates: Partial<AccountDoc> = {};
  if (typeof body?.displayName === "string")
    updates.displayName = body.displayName.trim();
  if (typeof body?.avatar === "string") updates.avatar = body.avatar;
  if (typeof body?.email === "string")
    updates.email = body.email.trim().toLowerCase();
  updates.updatedAt = new Date();

  if (updates.displayName !== undefined && !updates.displayName) {
    return c.json({ error: { message: "Display name wajib diisi" } }, 400);
  }

  const db = await getDb(c.env);
  const accounts = db.collection<AccountDoc>("accounts");

  if (updates.email) {
    const exists = await accounts.findOne({
      email: updates.email,
      _id: { $ne: _id },
    });
    if (exists)
      return c.json({ error: { message: "Email sudah dipakai" } }, 409);
  }

  await accounts.updateOne({ _id }, { $set: updates });
  const doc = await accounts.findOne({ _id });
  if (!doc) return c.json({ error: { message: "Not found" } }, 404);
  return c.json(toAccountPublic(doc));
});
