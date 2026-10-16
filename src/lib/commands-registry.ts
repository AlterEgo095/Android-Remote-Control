import { z } from "zod";
import type { RegistryEntry } from "./types";

// Registre des commandes autorisées — Automatisation (décision d'architecture figée)
// Seules ces commandes peuvent être émises par la console ; toute autre est refusée.
// Chaque commande possède un schéma de payload strict validé CÔTÉ SERVEUR.

export const COMMAND_REGISTRY: RegistryEntry[] = [
  {
    name: "SCREEN_VIEW",
    label: "Vue d'écran",
    description: "Démarrer le flux d'observation de l'écran via la session RustDesk (lecture seule).",
    risk: "FAIBLE",
    requiresControl: false,
    payloadHint: null,
  },
  {
    name: "SCREENSHOT",
    label: "Capture d'écran",
    description: "Capturer une image fixe de l'écran actuel de l'appareil.",
    risk: "FAIBLE",
    requiresControl: false,
    payloadHint: null,
  },
  {
    name: "APP_LAUNCH",
    label: "Lancement d'application",
    description: "Ouvrir une application par son identifiant de paquet Android.",
    risk: "MODERE",
    requiresControl: false,
    payloadHint: '{"package":"com.exemple.app"}',
  },
  {
    name: "TEXT_INPUT",
    label: "Saisie de texte",
    description: "Injecter une chaîne de texte dans le champ actif de l'appareil.",
    risk: "MODERE",
    requiresControl: true,
    payloadHint: '{"text":"message à saisir"}',
  },
  {
    name: "TAP",
    label: "Appui simulé",
    description: "Simuler un appui aux coordonnées écran indiquées (pixels).",
    risk: "MODERE",
    requiresControl: true,
    payloadHint: '{"x":540,"y":1200}',
  },
  {
    name: "SWIPE",
    label: "Balayage",
    description: "Simuler un balayage dans la direction indiquée.",
    risk: "MODERE",
    requiresControl: true,
    payloadHint: '{"dir":"HAUT|BAS|GAUCHE|DROITE"}',
  },
  {
    name: "LOCK",
    label: "Verrouillage de l'appareil",
    description: "Verrouiller immédiatement l'écran de l'appareil cible.",
    risk: "ELEVE",
    requiresControl: true,
    payloadHint: null,
  },
  {
    name: "REBOOT",
    label: "Redémarrage de l'appareil",
    description: "Redémarrer l'appareil — la session en cours sera interrompue.",
    risk: "ELEVE",
    requiresControl: true,
    payloadHint: null,
  },
];

export const REGISTRY_NAMES = COMMAND_REGISTRY.map((c) => c.name);

export function findCommand(name: string): RegistryEntry | undefined {
  return COMMAND_REGISTRY.find((c) => c.name === name);
}

// ——— Validation serveur des payloads (zod, schémas stricts) ————————————
// Aucune clé supplémentaire tolérée (.strict()) ; les commandes sans paramètre
// n'acceptent aucun payload ou un objet vide.

const NO_PAYLOAD = z.object({}).strict();

export const COMMAND_PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  SCREEN_VIEW: NO_PAYLOAD.optional(),
  SCREENSHOT: NO_PAYLOAD.optional(),
  APP_LAUNCH: z
    .object({
      package: z
        .string()
        .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){1,6}$/, "Identifiant de paquet Android invalide (ex. com.exemple.app)")
        .max(128),
    })
    .strict(),
  TEXT_INPUT: z
    .object({ text: z.string().min(1, "Texte requis").max(500, "500 caractères maximum") })
    .strict(),
  TAP: z
    .object({
      x: z.number().int().min(0).max(9999),
      y: z.number().int().min(0).max(9999),
    })
    .strict(),
  SWIPE: z
    .object({ dir: z.enum(["HAUT", "BAS", "GAUCHE", "DROITE"]) })
    .strict(),
  LOCK: NO_PAYLOAD.optional(),
  REBOOT: NO_PAYLOAD.optional(),
};

export type PayloadValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** Valide le payload brut d'une commande et retourne sa forme sérialisée. */
export function validateCommandPayload(
  name: string,
  rawPayload: unknown,
): PayloadValidation {
  const schema = COMMAND_PAYLOAD_SCHEMAS[name];
  if (!schema) return { ok: false, error: "Commande inconnue" };
  const parsed = schema.safeParse(rawPayload ?? undefined);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return { ok: false, error: `Payload invalide — ${where}${issue?.message ?? "schéma non respecté"}` };
  }
  const value = parsed.data;
  if (value === undefined) return { ok: true, value: null };
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return { ok: true, value: null };
  return { ok: true, value: JSON.stringify(value) };
}
