import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const devices = await db.device.findMany({
    include: { _count: { select: { sessions: true, commands: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(devices);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: {
    name?: string;
    model?: string;
    rustdeskId?: string;
    osVersion?: string;
    notes?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const name = body.name?.trim();
  const model = body.model?.trim();
  const rustdeskId = body.rustdeskId?.trim();
  if (!name || !model || !rustdeskId) {
    return NextResponse.json(
      { error: "Nom, modèle et identifiant RustDesk sont requis" },
      { status: 400 },
    );
  }

  const existing = await db.device.findUnique({ where: { rustdeskId } });
  if (existing) {
    return NextResponse.json(
      { error: "Cet identifiant RustDesk est déjà enregistré" },
      { status: 409 },
    );
  }

  const device = await db.device.create({
    data: {
      name,
      model,
      rustdeskId,
      osVersion: body.osVersion?.trim() || "Android 14",
      notes: body.notes?.trim() || null,
      status: "PENDING",
      authorized: false,
    },
    include: { _count: { select: { sessions: true, commands: true } } },
  });

  await recordAudit({
    actor: session.username,
    action: "DEVICE_REGISTERED",
    targetType: "DEVICE",
    targetId: device.id,
    decision: "ALLOWED",
    detail: `Appareil « ${device.name} » enregistré (ID RustDesk ${device.rustdeskId}) — en attente d'autorisation`,
    ip: request.headers.get("x-forwarded-for") ?? "local",
  });

  return NextResponse.json(device, { status: 201 });
}
