import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tick } from "@/lib/simulator";

/** Un pas de simulation : états réseau, exécution des commandes, audit. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  await tick();
  return NextResponse.json({ ok: true });
}
