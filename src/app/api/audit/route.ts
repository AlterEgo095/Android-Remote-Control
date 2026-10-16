import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Journal d'audit — filtres par décision et par type de cible. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const decision = request.nextUrl.searchParams.get("decision");
  const targetType = request.nextUrl.searchParams.get("targetType");

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
