import { bytesToBase64Url, base64UrlToBytes } from "./crypto";

const encoder = new TextEncoder();

type JwtPayload = {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
};

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export async function signJwtHS256(secret: string, payload: Omit<JwtPayload, "iat" | "exp">, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(full)));
  const body = `${encodedHeader}.${encodedPayload}`;
  const sig = await hmacSha256(secret, body);
  return `${body}.${bytesToBase64Url(sig)}`;
}

export async function verifyJwtHS256(secret: string, token: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const body = `${h}.${p}`;
  const expected = await hmacSha256(secret, body);
  const actual = base64UrlToBytes(s);
  if (actual.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  if (diff !== 0) return null;

  const payload = parseJson<JwtPayload>(new TextDecoder().decode(base64UrlToBytes(p)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

