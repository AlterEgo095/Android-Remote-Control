import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { hitRateLimit, peekRateLimit, resetRateLimit } from "@/lib/rate-limit";

// Connexion administrateur — durcie :
// - validation zod stricte des entrées ;
// - anti-bruteforce en mémoire : 5 échecs / 15 min par (IP) et par (IP+identifiant),
//   consultation dédiée pour éviter l'énumération d'identifiants ;
// - chaque échec et chaque blocage est journalisé dans l'audit (sans le mot de passe).

const LOGIN_SCHEMA = z.object({
  username: z.string().trim().min(1, "Identifiant requis").max(64),
  password: z.string().min(1, "Mot de passe requis").max(256),
});

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 5;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "inconnue";
  return request.headers.get("x-real-ip") ?? "inconnue";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = LOGIN_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis" }, { status: 400 });
  }
  const username = parsed.data.username;
  const ip = clientIp(request);

  const ipKey = `login:ip:${ip}`;
  const userKey = `login:user:${ip}:${username}`;

  // Blocage préalable ? (consultation sans incrément)
  const ipState = peekRateLimit(ipKey, MAX_ATTEMPTS * 3, WINDOW_MS);
  const userState = peekRateLimit(userKey, MAX_ATTEMPTS, WINDOW_MS);
  if (ipState.blocked || userState.blocked) {
    await recordAudit({
      actor: username,
      action: "LOGIN_RATE_LIMITED",
      targetType: "SYSTEM",
      decision: "DENIED",
      detail: `Tentative bloquée par anti-bruteforce ( trop de tentatives depuis ${ip} )`,
      ip,
    });
    return NextResponse.json(
      { error: "Trop de tentatives — réessayez plus tard" },
      { status: 429, headers: { "Retry-After": String(userState.retryAfterSeconds) } },
    );
  }

  const user = await db.adminUser.findUnique({ where: { username } });

  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    hitRateLimit(ipKey, MAX_ATTEMPTS * 3, WINDOW_MS);
    const userHit = hitRateLimit(userKey, MAX_ATTEMPTS, WINDOW_MS);
    await recordAudit({
      actor: username,
      action: "LOGIN_DENIED",
      targetType: "SYSTEM",
      decision: "DENIED",
      detail: userHit.blocked
        ? `Échec d'authentification pour « ${username} » — identifiant bloqué 15 minutes depuis cette IP`
        : `Échec d'authentification pour « ${username} » (tentative ${userHit.count}/${MAX_ATTEMPTS})`,
      ip,
    });
    const status = userHit.blocked ? 429 : 401;
    const message = userHit.blocked
      ? "Trop de tentatives — réessayez plus tard"
      : "Identifiants invalides";
    const headers = userHit.blocked
      ? { "Retry-After": String(userHit.retryAfterSeconds) }
      : undefined;
    return NextResponse.json({ error: message }, { status, headers });
  }

  resetRateLimit(ipKey);
  resetRateLimit(userKey);

  await setSessionCookie(user.username, user.role);
  await recordAudit({
    actor: user.username,
    action: "LOGIN_ALLOWED",
    targetType: "SYSTEM",
    decision: "ALLOWED",
    detail: `Connexion établie (rôle ${user.role})`,
    ip,
  });

  return NextResponse.json({ user: { username: user.username, role: user.role } });
}
