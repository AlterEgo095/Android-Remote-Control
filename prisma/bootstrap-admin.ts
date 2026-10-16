// Bootstrap du premier administrateur — Android Remote Control v1.0
// Procédure sécurisée d'initialisation (mode production) :
//
//   docker compose -f docker-compose.vps.yml run --rm console \
//     bun prisma/bootstrap-admin.ts
//
// - ARC_ADMIN_USERNAME : identifiant (3–64 caractères, [a-zA-Z0-9._-]) — requis.
// - ARC_ADMIN_PASSWORD : mot de passe (>= 12 caractères). S'il est absent, un
//   mot de passe fort est GÉNÉRÉ et affiché UNE SEULE FOIS dans la sortie.
// - ARC_ADMIN_RESET=true : réinitialise le mot de passe si l'identifiant existe
//   déjà (sinon le script refuse, pour éviter tout écrasement accidentel).
//
// Le script n'est JAMAIS exécuté automatiquement au démarrage du conteneur.
// Après usage : retirer ARC_ADMIN_PASSWORD du fichier .env et régénérer les
// sessions (les anciens mots de passe restent valables jusqu'à rotation).

import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Mot de passe fort garanti : majuscules + minuscules + chiffres + symboles. */
function generateStrongPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=";
  let candidate = "";
  do {
    const bytes = randomBytes(20);
    candidate = Array.from(bytes)
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  } while (
    !/[A-Z]/.test(candidate) ||
    !/[a-z]/.test(candidate) ||
    !/[0-9]/.test(candidate) ||
    !/[^A-Za-z0-9]/.test(candidate)
  );
  return candidate;
}

async function main() {
  const username = process.env.ARC_ADMIN_USERNAME?.trim() ?? "";
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    console.error(
      "[ARC] ARC_ADMIN_USERNAME requis (3–64 caractères : lettres, chiffres, . _ -).",
    );
    process.exit(1);
  }

  let generated = false;
  let password = process.env.ARC_ADMIN_PASSWORD ?? "";
  if (password) {
    if (password.length < 12) {
      console.error("[ARC] ARC_ADMIN_PASSWORD doit contenir au moins 12 caractères.");
      process.exit(1);
    }
  } else {
    password = generateStrongPassword();
    generated = true;
  }

  const existing = await db.adminUser.findUnique({ where: { username } });
  if (existing && process.env.ARC_ADMIN_RESET !== "true") {
    console.error(
      `[ARC] Refus : l'administrateur « ${username} » existe déjà. Utilisez ARC_ADMIN_RESET=true pour réinitialiser son mot de passe.`,
    );
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  if (existing) {
    await db.adminUser.update({ where: { username }, data: { passwordHash } });
    console.log(`[ARC] Mot de passe réinitialisé pour « ${username} ».`);
  } else {
    await db.adminUser.create({ data: { username, passwordHash, role: "ADMIN" } });
    console.log(`[ARC] Administrateur « ${username} » créé (rôle ADMIN).`);
  }

  if (generated) {
    console.log("[ARC] ┌──────────────────────────────────────────────────────┐");
    console.log(`[ARC] │ Mot de passe généré (à conserver IMMÉDIATEMENT) : ${password}`);
    console.log("[ARC] │ Ce message ne sera plus affiché.                     │");
    console.log("[ARC] └──────────────────────────────────────────────────────┘");
  }
  console.log("[ARC] Pensez à retirer ARC_ADMIN_PASSWORD du fichier .env après usage.");
}

main()
  .catch((error) => {
    console.error("[ARC] Échec du bootstrap :", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
