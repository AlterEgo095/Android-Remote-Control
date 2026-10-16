import { NextResponse } from "next/server";

/** Health-check — utilisé par la supervision (Docker, Nginx, monitoring). */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "android-remote-control-console",
    version: "1.0",
    timestamp: new Date().toISOString(),
  });
}
