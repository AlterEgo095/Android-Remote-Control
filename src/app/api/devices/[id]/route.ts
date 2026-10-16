import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/** Fiche appareil : détails + historiques récents (sessions, commandes). */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await context.params;

  const device = await db.device.findUnique({
    where: { id },
    include: { _count: { select: { sessions: true, commands: true } } },
  });
  if (!device) {
    return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });
  }

  const [sessions, commands] = await Promise.all([
    db.session.findMany({ where: { deviceId: id }, orderBy: { startedAt: "desc" }, take: 5 }),
    db.command.findMany({ where: { deviceId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return NextResponse.json({ device, sessions, commands });
}

/** Actions administratives : autoriser, révoquer, annoter. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await context.params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });
  }

  let body: { action?: "authorize" | "revoke"; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";

  if (body.action === "authorize") {
    if (device.authorized) {
      return NextResponse.json({ error: "Cet appareil est déjà autorisé" }, { status: 409 });
    }
    const now = new Date();
    const updated = await db.device.update({
      where: { id },
      data: { authorized: true, status: "ONLINE", lastSeenAt: now },
      include: { _count: { select: { sessions: true, commands: true } } },
    });
    await recordAudit({
      actor: session.username,
      action: "DEVICE_AUTHORIZED",
      targetType: "DEVICE",
      targetId: id,
      decision: "ALLOWED",
      detail: `Appareil « ${device.name} » autorisé — première connexion établie`,
      ip,
    });
    return NextResponse.json(updated);
  }

  if (body.action === "revoke") {
    const now = new Date();
    // Fermer les sessions actives : la révocation empêche tout accès via la plateforme.
    await db.session.updateMany({
      where: { deviceId: id, status: "ACTIVE" },
      data: { status: "CLOSED", endedAt: now },
    });
    const activeCount = await db.session.count({
      where: { deviceId: id, status: "ACTIVE" },
    });
    const updated = await db.device.update({
      where: { id },
      data: { authorized: false, status: "REVOKED" },
      include: { _count: { select: { sessions: true, commands: true } } },
    });
    await recordAudit({
      actor: session.username,
      action: "DEVICE_REVOKED",
      targetType: "DEVICE",
      targetId: id,
      decision: "ALLOWED",
      detail: `Accès révoqué pour « ${device.name} » — sessions actives fermées (${activeCount} restante(s) à la fermeture), l'appareil ne peut plus être contacté`,
      ip,
    });
    return NextResponse.json(updated);
  }

  if (body.notes !== undefined) {
    const updated = await db.device.update({
      where: { id },
      data: { notes: body.notes.trim() || null },
      include: { _count: { select: { sessions: true, commands: true } } },
    });
    await recordAudit({
      actor: session.username,
      action: "DEVICE_NOTES_UPDATED",
      targetType: "DEVICE",
      targetId: id,
      decision: "ALLOWED",
      detail: `Notes mises à jour pour « ${device.name} »`,
      ip,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
