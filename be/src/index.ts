import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./env";
import { authRoutes } from "./routes/auth";
import { accountsRoutes } from "./routes/accounts";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN || origin || origin || "",
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
    credentials: true,
  }),
);

app.get("/", (c) => c.json({ ok: true, name: "dunia-aplikasi-be" }));

app.route("/auth", authRoutes);
app.route("/accounts", accountsRoutes);

export default app;
