import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { findCommand } from "@/lib/commands-registry";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const commands = await db.command.findMany({
    include: { device: { select: { id: true, name: true, rustdeskId: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(commands);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { deviceId?: string; name?: string; payload?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";

  if (!body.deviceId || !body.name) {
    return NextResponse.json({ error: "Appareil et commande requis" }, { status: 400 });
  }

  // Registre des commandes autorisées : toute commande hors registre est rejetée.
  const registryEntry = findCommand(body.name);
  if (!registryEntry) {
    return NextResponse.json(
      { error: "Commande inconnue — absente du registre des commandes autorisées" },
      { status: 400 },
    );
  }

  const device = await db.device.findUnique({ where: { id: body.deviceId } });
  if (!device) {
    return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });
  }

  const payload = body.payload ? JSON.stringify(body.payload) : null;

  // Refus 1 : appareil non autorisé ou révoqué → commande REFUSED journalisée.
  if (!device.authorized || device.status === "REVOKED") {
    const refused = await db.command.create({
      data: {
        deviceId: device.id,
        name: registryEntry.name,
        payload,
        status: "REFUSED",
        result: "Refusée : appareil non autorisé ou accès révoqué",
      },
      include: { device: { select: { id: true, name: true, rustdeskId: true } } },
    });
    await recordAudit({
      actor: session.username,
      action: "COMMAND_REFUSED",
      targetType: "COMMAND",
      targetId: refused.id,
      decision: "DENIED",
      detail: `${registryEntry.name} refusée sur « ${device.name} » : appareil non autorisé ou accès révoqué`,
      ip,
    });
    return NextResponse.json(refused, { status: 201 });
  }

  // Refus 2 : commande nécessitant une session de contrôle active.
  if (registryEntry.requiresControl) {
    const activeControl = await db.session.findFirst({
      where: { deviceId: device.id, status: "ACTIVE", kind: "CONTROL" },
    });
    if (!activeControl) {
      const refused = await db.command.create({
        data: {
          deviceId: device.id,
          name: registryEntry.name,
          payload,
          status: "REFUSED",
          result: "Refusée : cette commande nécessite une session de contrôle active",
        },
        include: { device: { select: { id: true, name: true, rustdeskId: true } } },
      });
      await recordAudit({
        actor: session.username,
        action: "COMMAND_REFUSED",
        targetType: "COMMAND",
        targetId: refused.id,
        decision: "DENIED",
        detail: `${registryEntry.name} refusée sur « ${device.name} » : aucune session de contrôle active`,
        ip,
      });
      return NextResponse.json(refused, { status: 201 });
    }
  }

  const created = await db.command.create({
    data: {
      deviceId: device.id,
      name: registryEntry.name,
      payload,
      status: "PENDING",
    },
    include: { device: { select: { id: true, name: true, rustdeskId: true } } },
  });

  await recordAudit({
    actor: session.username,
    action: "COMMAND_ISSUED",
    targetType: "COMMAND",
    targetId: created.id,
    decision: "ALLOWED",
    detail: `${registryEntry.label} (${registryEntry.name}) émise vers « ${device.name} »`,
    ip,
  });

  return NextResponse.json(created, { status: 201 });
}
