import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session) {
    await recordAudit({
      actor: session.username,
      action: "LOGOUT",
      targetType: "SYSTEM",
      decision: "ALLOWED",
      detail: "Déconnexion de la console d'administration",
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
