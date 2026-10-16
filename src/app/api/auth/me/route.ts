import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ARC_MODE } from "@/lib/config";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return NextResponse.json({ user: session, mode: ARC_MODE });
}
