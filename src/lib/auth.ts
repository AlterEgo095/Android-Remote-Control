import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { COOKIE_SECURE, SESSION_MAX_AGE_SECONDS, SESSION_SECRET } from "./config";

const COOKIE_NAME = "arc_token";

export interface SessionUser {
  username: string;
  role: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ——— Token de session signé (HMAC-SHA256) ————————————————————————————
// Format : base64url(payload).base64url(hmac)
// Le payload porte son expiration ; le serveur vérifie signature ET expiration.

interface SessionPayload {
  u: string;
  r: string;
  iat: number;
  exp: number;
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function setSessionCookie(username: string, role: string): Promise<void> {
  const store = await cookies();
  const now = Date.now();
  const payload: SessionPayload = {
    u: username,
    r: role,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  store.set(COOKIE_NAME, `${payloadB64}.${signPayload(payloadB64)}`, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Lit le cookie, vérifie la signature HMAC, l'expiration serveur et
 * l'existence de l'utilisateur. Toute anomalie → session nulle.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0) return null;
  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!safeEqual(signature, signPayload(payloadB64))) return null;
  try {
    const data = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as Partial<SessionPayload>;
    if (!data.u || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null; // expiration vérifiée côté serveur
    const user = await db.adminUser.findUnique({ where: { username: data.u } });
    if (!user) return null;
    return { username: user.username, role: user.role };
  } catch {
    return null;
  }
}
