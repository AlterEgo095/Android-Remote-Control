import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/** Fermer une session administrative. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await context.params;

  let body: { action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (body.action !== "close") {
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }

  const existing = await db.session.findUnique({
    where: { id },
    include: { device: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
  if (existing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cette session n'est plus active" }, { status: 409 });
  }

  const now = new Date();
  const updated = await db.session.update({
    where: { id },
    data: { status: "CLOSED", endedAt: now },
    include: { device: { select: { id: true, name: true, rustdeskId: true } } },
  });

  await recordAudit({
    actor: session.username,
    action: "SESSION_CLOSED",
    targetType: "SESSION",
    targetId: id,
    decision: "ALLOWED",
    detail: `Session fermée par l'administrateur sur « ${existing.device.name} »`,
    ip: request.headers.get("x-forwarded-for") ?? "local",
  });

  return NextResponse.json(updated);
}
