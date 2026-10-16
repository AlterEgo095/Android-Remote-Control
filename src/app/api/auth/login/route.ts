import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis" }, { status: 400 });
  }

  const user = await db.adminUser.findUnique({ where: { username } });
  const ip = request.headers.get("x-forwarded-for") ?? "local";

  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordAudit({
      actor: username,
      action: "LOGIN_DENIED",
      targetType: "SYSTEM",
      decision: "DENIED",
      detail: `Échec d'authentification pour « ${username} »`,
      ip,
    });
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

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
