import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Contrôle de disponibilité minimal — exposition volontairement réduite :
// aucune version, aucun détail d'infrastructure. 200 = service + base OK.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
