import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tick } from "@/lib/simulator";
import { IS_PRODUCTION_MODE } from "@/lib/config";

/** Un pas de simulation : états réseau, exécution des commandes, audit.
 *  Strictement indisponible en mode production — aucune donnée fabriquée. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (IS_PRODUCTION_MODE) {
    return NextResponse.json(
      { error: "Simulateur indisponible en mode production" },
      { status: 503 },
    );
  }
  await tick();
  return NextResponse.json({ ok: true });
}
