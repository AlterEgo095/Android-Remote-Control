import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { COMMAND_REGISTRY } from "@/lib/commands-registry";

/** Registre des commandes autorisées (décision d'architecture figée). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return NextResponse.json(COMMAND_REGISTRY);
}
