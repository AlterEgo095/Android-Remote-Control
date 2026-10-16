import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Journal d'audit — filtres par décision et par type de cible (valeurs contraintes). */
const VALID_DECISIONS = ["ALLOWED", "DENIED", "ERROR"] as const;
const VALID_TARGET_TYPES = ["DEVICE", "SESSION", "COMMAND", "SYSTEM"] as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const decision = request.nextUrl.searchParams.get("decision");
  const targetType = request.nextUrl.searchParams.get("targetType");

  // Filtres stricts : toute valeur hors énumération est rejetée (400).
  if (decision && !(VALID_DECISIONS as readonly string[]).includes(decision)) {
    return NextResponse.json({ error: "Filtre décision invalide" }, { status: 400 });
  }
  if (targetType && !(VALID_TARGET_TYPES as readonly string[]).includes(targetType)) {
    return NextResponse.json({ error: "Filtre type de cible invalide" }, { status: 400 });
  }

  const events = await db.auditEvent.findMany({
    where: {
      ...(decision ? { decision } : {}),
      ...(targetType ? { targetType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(events);
}
