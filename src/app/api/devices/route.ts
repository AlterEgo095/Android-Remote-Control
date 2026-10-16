import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const DEVICE_CREATE_SCHEMA = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  model: z.string().trim().min(1, "Modèle requis").max(100),
  rustdeskId: z
    .string()
    .trim()
    .regex(/^[0-9][0-9 \-]{5,20}$/, "Identifiant RustDesk invalide (9 chiffres, espaces acceptés)"),
  osVersion: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(2000).optional(),
});

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

  const parsed = DEVICE_CREATE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Champs invalides — nom, modèle et identifiant RustDesk requis" },
      { status: 400 },
    );
  }
  const { name, model, rustdeskId, osVersion, notes } = parsed.data;

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
      osVersion: osVersion || "Android 14",
      notes: notes || null,
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
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue",
  });

  return NextResponse.json(device, { status: 201 });
}
