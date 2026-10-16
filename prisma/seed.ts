// Seed du prototype — Android Remote Control v1.0
// Exécution : bun prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Nettoyage des tables…");
  await db.auditEvent.deleteMany();
  await db.command.deleteMany();
  await db.session.deleteMany();
  await db.device.deleteMany();
  await db.adminUser.deleteMany();

  console.log("Création de l'administrateur…");
  await db.adminUser.create({
    data: {
      username: "admin",
      passwordHash: hashPassword("Arc@2024!"),
      role: "ADMIN",
    },
  });

  console.log("Création des appareils…");
  const pixel = await db.device.create({
    data: {
      name: "Pixel 7 — Atelier",
      model: "Google Pixel 7",
      osVersion: "Android 14",
      rustdeskId: "481 902 335",
      status: "ONLINE",
      authorized: true,
      lastSeenAt: new Date(),
      notes: "Appareil de test principal (phase 02 — Connexion RustDesk).",
    },
  });
  const galaxy = await db.device.create({
    data: {
      name: "Galaxy A54 — Terrain",
      model: "Samsung Galaxy A54",
      osVersion: "Android 14",
      rustdeskId: "774 218 906",
      status: "OFFLINE",
      authorized: true,
      lastSeenAt: new Date(Date.now() - 24 * 60 * 1000),
      notes: "Déployé sur site client — accessible depuis un réseau extérieur.",
    },
  });
  const redmi = await db.device.create({
    data: {
      name: "Redmi Note 12 — Test",
      model: "Xiaomi Redmi Note 12",
      osVersion: "Android 14",
      rustdeskId: "902 553 147",
      status: "PENDING",
      authorized: false,
      notes: "En attente d'autorisation administrateur.",
    },
  });
  const nokia = await db.device.create({
    data: {
      name: "Nokia G22 — Réserve",
      model: "Nokia G22",
      osVersion: "Android 13",
      rustdeskId: "338 604 972",
      status: "REVOKED",
      authorized: false,
      notes: "Accès révoqué après la campagne de tests (critère d'acceptation n° 6).",
    },
  });

  console.log("Création des sessions historiques…");
  const sessionOk = await db.session.create({
    data: {
      deviceId: pixel.id,
      kind: "OBSERVE",
      status: "CLOSED",
      sourceIp: "203.0.113.24",
      startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
    },
  });
  await db.session.create({
    data: {
      deviceId: galaxy.id,
      kind: "CONTROL",
      status: "FAILED",
      sourceIp: "198.51.100.7",
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + 7 * 60 * 1000),
    },
  });
  await db.session.create({
    data: {
      deviceId: nokia.id,
      kind: "OBSERVE",
      status: "CLOSED",
      sourceIp: "203.0.113.24",
      startedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 25.5 * 60 * 60 * 1000),
    },
  });

  console.log("Création des commandes historiques…");
  const now = Date.now();
  const cmd = (offsetMs: number, status: string, result: string, executed = true) => ({
    createdAt: new Date(now - offsetMs),
    executedAt: executed ? new Date(now - offsetMs + 4200) : null,
    status,
    result,
  });
  await db.command.create({
    data: {
      deviceId: pixel.id,
      sessionId: sessionOk.id,
      name: "SCREEN_VIEW",
      ...cmd(4.8 * 60 * 60 * 1000, "SUCCESS", "Flux d'écran établi sur Pixel 7 — Atelier — 1080×2400 @ 12 fps (relais RustDesk)"),
    },
  });
  await db.command.create({
    data: {
      deviceId: pixel.id,
      name: "SCREENSHOT",
      ...cmd(4.6 * 60 * 60 * 1000, "SUCCESS", "Capture enregistrée (PNG, 1080×2400)"),
    },
  });
  await db.command.create({
    data: {
      deviceId: galaxy.id,
      name: "TAP",
      payload: JSON.stringify({ x: 540, y: 1200 }),
      ...cmd(2.9 * 60 * 60 * 1000, "FAILED", "Échec : le service d'accessibilité n'a pas répondu"),
    },
  });
  await db.command.create({
    data: {
      deviceId: nokia.id,
      name: "SCREEN_VIEW",
      ...cmd(25.8 * 60 * 60 * 1000, "REFUSED", "Refusée : appareil non autorisé ou accès révoqué"),
    },
  });

  console.log("Création du journal d'audit…");
  const evt = (
    offsetMs: number,
    actor: string,
    action: string,
    targetType: string,
    targetId: string | null,
    decision: string,
    detail: string,
  ) => ({
    createdAt: new Date(now - offsetMs),
    actor,
    action,
    targetType,
    targetId,
    decision,
    detail,
  });
  await db.auditEvent.createMany({
    data: [
      evt(
        30 * 60 * 60 * 1000,
        "admin",
        "DEVICE_REGISTERED",
        "DEVICE",
        pixel.id,
        "ALLOWED",
        "Appareil « Pixel 7 — Atelier » enregistré (ID RustDesk 481 902 335) — en attente d'autorisation",
      ),
      evt(
        29.9 * 60 * 60 * 1000,
        "admin",
        "DEVICE_AUTHORIZED",
        "DEVICE",
        pixel.id,
        "ALLOWED",
        "Appareil « Pixel 7 — Atelier » autorisé — première connexion établie",
      ),
      evt(
        26 * 60 * 60 * 1000,
        "admin",
        "DEVICE_REVOKED",
        "DEVICE",
        nokia.id,
        "ALLOWED",
        "Accès révoqué pour « Nokia G22 — Réserve » — sessions actives fermées, l'appareil ne peut plus être contacté",
      ),
      evt(
        25.8 * 60 * 60 * 1000,
        "admin",
        "COMMAND_REFUSED",
        "COMMAND",
        null,
        "DENIED",
        "SCREEN_VIEW refusée sur « Nokia G22 — Réserve » : appareil non autorisé ou accès révoqué",
      ),
      evt(
        5 * 60 * 60 * 1000,
        "admin",
        "SESSION_OPENED",
        "SESSION",
        sessionOk.id,
        "ALLOWED",
        "Session d'observation ouverte sur « Pixel 7 — Atelier » depuis un réseau extérieur (relais RustDesk)",
      ),
      evt(
        2.9 * 60 * 60 * 1000,
        "simulateur",
        "COMMAND_FAILED",
        "COMMAND",
        null,
        "ERROR",
        "TAP : Échec — le service d'accessibilité n'a pas répondu (Galaxy A54 — Terrain)",
      ),
      evt(
        2.5 * 60 * 60 * 1000,
        "simulateur",
        "DEVICE_OFFLINE",
        "DEVICE",
        galaxy.id,
        "ERROR",
        "Galaxy A54 — Terrain est devenu injoignable (perte réseau simulée, phase 05)",
      ),
      evt(
        2.4 * 60 * 60 * 1000,
        "simulateur",
        "DEVICE_RECONNECTED",
        "DEVICE",
        galaxy.id,
        "ALLOWED",
        "Galaxy A54 — Terrain a rétabli sa connexion",
      ),
      evt(
        1.2 * 60 * 60 * 1000,
        "admin",
        "LOGIN_DENIED",
        "SYSTEM",
        null,
        "DENIED",
        "Échec d'authentification pour « root »",
      ),
    ],
  });

  console.log("Seed terminé : 1 admin, 4 appareils, 3 sessions, 4 commandes, 9 événements d'audit.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
