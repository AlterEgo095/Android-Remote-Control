import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "arc_token";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 h

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

export async function setSessionCookie(username: string, role: string): Promise<void> {
  const store = await cookies();
  const token = Buffer.from(JSON.stringify({ u: username, r: role, t: Date.now() })).toString(
    "base64url",
  );
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Lit le cookie, vérifie que l'utilisateur existe toujours, retourne la session. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const data = JSON.parse(Buffer.from(token, "base64url").toString()) as {
      u?: string;
      r?: string;
    };
    if (!data.u) return null;
    const user = await db.adminUser.findUnique({ where: { username: data.u } });
    if (!user) return null;
    return { username: user.username, role: user.role };
  } catch {
    return null;
  }
}
