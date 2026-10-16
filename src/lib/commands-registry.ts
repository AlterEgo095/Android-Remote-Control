import type { RegistryEntry } from "./types";

// Registre des commandes autorisées — Automatisation (décision d'architecture figée)
// Seules ces commandes peuvent être émises par la console ; toute autre est refusée.

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
