import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { IS_PRODUCTION_MODE } from "@/lib/config";

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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";

  if (body.action === "authorize") {
    if (device.authorized) {
      return NextResponse.json({ error: "Cet appareil est déjà autorisé" }, { status: 409 });
    }
    const now = new Date();
    // En production, l'appareil n'est marqué « en ligne » QUE lorsqu'un
    // battement de cœur réel (agent/hbbs) sera implémenté — ici il reste
    // « En attente de première connexion ».
    const updated = await db.device.update({
      where: { id },
      data: {
        authorized: true,
        status: IS_PRODUCTION_MODE ? "PENDING" : "ONLINE",
        lastSeenAt: IS_PRODUCTION_MODE ? null : now,
      },
      include: { _count: { select: { sessions: true, commands: true } } },
    });
    await recordAudit({
      actor: session.username,
      action: "DEVICE_AUTHORIZED",
      targetType: "DEVICE",
      targetId: id,
      decision: "ALLOWED",
      detail: IS_PRODUCTION_MODE
        ? `Appareil « ${device.name} » autorisé — en attente de première connexion réelle (intégration terminal à venir)`
        : `Appareil « ${device.name} » autorisé — première connexion établie (simulation)`,
      ip,
    });
    return NextResponse.json(updated);
  }

  if (body.action === "revoke") {
    const now = new Date();
    // Compter AVANT la fermeture : le message d'audit doit refléter la réalité.
    const activeCount = await db.session.count({
      where: { deviceId: id, status: "ACTIVE" },
    });
    // Fermer les sessions actives : la révocation empêche tout accès via la plateforme.
    // NB : en production, l'interruption du flux RustDesk réel devra être confirmée
    // par l'intégration (clôture côté hbbs/agent) — ici la session applicative est close.
    await db.session.updateMany({
      where: { deviceId: id, status: "ACTIVE" },
      data: { status: "CLOSED", endedAt: now },
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
      detail: `Accès révoqué pour « ${device.name} » — ${activeCount} session(s) active(s) fermée(s), l'appareil ne peut plus être contacté`,
      ip,
    });
    return NextResponse.json(updated);
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) {
      return NextResponse.json(
        { error: "Notes invalides (2 000 caractères maximum)" },
        { status: 400 },
      );
    }
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
