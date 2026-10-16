import { NextResponse } from "next/server";
import { ARC_MODE } from "@/lib/config";

// Configuration publique minimale (avant connexion) : le mode d'exécution
// uniquement, afin que l'interface affiche l'état réel de la plateforme
// (« Simulation » vs « Production — intégration indisponible »).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ mode: ARC_MODE });
}
