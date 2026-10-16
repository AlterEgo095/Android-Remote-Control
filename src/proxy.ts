import { NextRequest, NextResponse } from "next/server";

// Défense CSRF (complément du cookie SameSite=Lax) :
// toute requête mutante (POST/PATCH/PUT/DELETE) vers /api/* présentant un
// en-tête Origin dont l'hôte ne correspond pas à l'hôte servi est rejetée (403).
// Les navigateurs envoient toujours Origin sur les requêtes cross-site —
// un attaquant externe ne peut donc pas usurper les cookies de session.
// Les clients non-navigateurs (curl, supervision) sans Origin restent autorisés.
// NB : Next.js 16 — le fichier `proxy.ts` remplace l'ancien `middleware.ts`.

export default function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.next();

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = "";
  }

  if (!host || !originHost || originHost !== host) {
    return NextResponse.json(
      { error: "Origine de la requête refusée (protection CSRF)" },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
