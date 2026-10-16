// Configuration d'exécution centralisée — Android Remote Control v1.0
// Toutes les variables d'environnement applicatives sont lues ICI (une seule fois).
// Ne jamais lire process.env directement dans les routes/composants.

export type ArcMode = "simulation" | "production";

/**
 * Mode d'exécution :
 * - "simulation" (défaut) : prototype — le moteur de simulation fabrique les
 *   états réseau et les résultats de commandes (aucun appareil réel requis).
 * - "production" : aucune donnée fabriquée. Les sessions/commandes réelles
 *   exigent l'intégration terminal (agent Android) + RustDesk, sinon la
 *   plateforme répond « intégration indisponible ».
 */
export const ARC_MODE: ArcMode =
  process.env.ARC_MODE === "production" ? "production" : "simulation";

export const IS_SIMULATION: boolean = ARC_MODE === "simulation";
export const IS_PRODUCTION_MODE: boolean = !IS_SIMULATION;

/**
 * Cookie de session `Secure` : activé par défaut en mode production
 * (HTTPS derrière Nginx). Surcharge possible via ARC_COOKIE_SECURE=true|false.
 */
export const COOKIE_SECURE: boolean = process.env.ARC_COOKIE_SECURE
  ? process.env.ARC_COOKIE_SECURE === "true"
  : IS_PRODUCTION_MODE;

/**
 * Secret HMAC de signature des cookies de session.
 * - Obligatoire en mode production (>= 32 caractères) : le serveur refuse de
 *   démarrer sans lui (fail-fast au chargement de ce module).
 * - En simulation, une valeur de repli dédiée au développement est utilisée.
 * Générer : openssl rand -base64 48
 */
function resolveSessionSecret(): string {
  const secret = process.env.ARC_SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (IS_PRODUCTION_MODE) {
    throw new Error(
      "[ARC] ARC_SESSION_SECRET manquant ou trop court (32 caractères minimum) — démarrage refusé",
    );
  }
  return "arc-simulation-only-dev-secret-NE-PAS-UTILISER-EN-PRODUCTION";
}

export const SESSION_SECRET: string = resolveSessionSecret();

/** Durée de vie d'une session administrateur (secondes). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 h
