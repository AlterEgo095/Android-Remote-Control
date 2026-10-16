import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const sessions = await db.session.findMany({
    include: { device: { select: { id: true, name: true, rustdeskId: true } } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { deviceId?: string; kind?: "OBSERVE" | "CONTROL" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const kind = body.kind === "CONTROL" ? "CONTROL" : "OBSERVE";
  const ip = request.headers.get("x-forwarded-for") ?? "local";

  if (!body.deviceId) {
    return NextResponse.json({ error: "Appareil cible requis" }, { status: 400 });
  }

  const device = await db.device.findUnique({ where: { id: body.deviceId } });
  if (!device) {
    return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });
  }

  // Refus : appareil non autorisé ou révoqué → journalisé dans l'audit.
  if (!device.authorized || device.status === "REVOKED") {
    await recordAudit({
      actor: session.username,
      action: "SESSION_DENIED",
      targetType: "DEVICE",
      targetId: device.id,
      decision: "DENIED",
      detail: `Session ${kind === "CONTROL" ? "de contrôle" : "d'observation"} refusée sur « ${device.name} » : appareil non autorisé ou accès révoqué`,
      ip,
    });
    return NextResponse.json(
      { error: "Session refusée : appareil non autorisé ou accès révoqué" },
      { status: 403 },
    );
  }

  // Refus : appareil injoignable (aucune session possible hors réseau).
  if (device.status !== "ONLINE") {
    await recordAudit({
      actor: session.username,
      action: "SESSION_DENIED",
      targetType: "DEVICE",
      targetId: device.id,
      decision: "ERROR",
      detail: `Session refusée sur « ${device.name} » : appareil injoignable`,
      ip,
    });
    return NextResponse.json(
      { error: "Appareil injoignable — impossible d'ouvrir une session" },
      { status: 409 },
    );
  }

  const created = await db.session.create({
    data: {
      deviceId: device.id,
      kind,
      status: "ACTIVE",
      sourceIp: "203.0.113.24",
    },
    include: { device: { select: { id: true, name: true, rustdeskId: true } } },
  });

  await recordAudit({
    actor: session.username,
    action: "SESSION_OPENED",
    targetType: "SESSION",
    targetId: created.id,
    decision: "ALLOWED",
    detail: `Session ${kind === "CONTROL" ? "de contrôle" : "d'observation"} ouverte sur « ${device.name} » depuis un réseau extérieur (relais RustDesk)`,
    ip,
  });

  return NextResponse.json(created, { status: 201 });
}
