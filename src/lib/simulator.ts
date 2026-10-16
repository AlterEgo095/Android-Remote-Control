import { db } from "./db";
import { recordAudit } from "./audit";

// ——— Moteur de simulation (prototype) ————————————————————————————————
// Remplace le téléphone Android 14 réel + la signalisation RustDesk du VPS :
// - battements de cœur des appareils autorisés (connexions / pertes réseau) ;
// - exécution progressive des commandes (PENDING → RUNNING → SUCCESS/FAILED) ;
// - interruptions de session sur perte réseau ;
// - journalisation d'audit de tous les événements système.

const CHANCE_OFFLINE = 0.07; // par tick, un appareil en ligne peut perdre le réseau
const CHANCE_RECONNECT = 0.4; // par tick, un appareil hors ligne peut se reconnecter
const SUCCESS_RATE = 0.8; // part des commandes exécutées avec succès
const PENDING_DELAY_MS = 1600; // temps de prise en charge
const RUNNING_DELAY_MS = 3400; // temps d'exécution total avant résolution

let ticking = false;

function successResult(name: string, payload: string | null, deviceName: string): string {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = payload ? (JSON.parse(payload) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  switch (name) {
    case "SCREEN_VIEW":
      return `Flux d'écran établi sur ${deviceName} — 1080×2400 @ 12 fps (relais RustDesk)`;
    case "SCREENSHOT":
      return "Capture enregistrée (PNG, 1080×2400)";
    case "APP_LAUNCH":
      return `Application ${String(parsed.package ?? "inconnue")} lancée en premier plan`;
    case "TEXT_INPUT": {
      const text = String(parsed.text ?? "");
      return `Texte injecté dans le champ actif (${text.length} caractère${text.length > 1 ? "s" : ""})`;
    }
    case "TAP":
      return `Appui simulé en (${String(parsed.x ?? "?")}, ${String(parsed.y ?? "?")})`;
    case "SWIPE":
      return `Balayage ${String(parsed.dir ?? "")} exécuté`;
    case "LOCK":
      return "Appareil verrouillé à distance";
    case "REBOOT":
      return "Redémarrage initié — l'appareil sera de nouveau joignable sous peu";
    default:
      return "Commande exécutée";
  }
}

const FAILURE_RESULTS = [
  "Échec : le service d'accessibilité n'a pas répondu",
  "Échec : permission Android manquante (superposition)",
  "Échec : délai d'attente dépassé côté relais",
  "Échec : l'appareil a refusé l'injection d'entrée",
];

export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const now = new Date();

    // ——— 1. Battements de cœur des appareils autorisés
    const devices = await db.device.findMany({
      where: { authorized: true },
      include: { sessions: { where: { status: "ACTIVE" } } },
    });

    for (const device of devices) {
      if (device.status === "ONLINE") {
        await db.device.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });
        if (Math.random() < CHANCE_OFFLINE) {
          await db.device.update({
            where: { id: device.id },
            data: { status: "OFFLINE" },
          });
          for (const session of device.sessions) {
            await db.session.update({
              where: { id: session.id },
              data: { status: "FAILED", endedAt: now },
            });
          }
          await recordAudit({
            actor: "simulateur",
            action: "DEVICE_OFFLINE",
            targetType: "DEVICE",
            targetId: device.id,
            decision: "ERROR",
            detail: `${device.name} est devenu injoignable (perte réseau simulée, phase 05)`,
          });
          if (device.sessions.length > 0) {
            await recordAudit({
              actor: "simulateur",
              action: "SESSION_INTERRUPTED",
              targetType: "SESSION",
              targetId: device.sessions[0].id,
              decision: "ERROR",
              detail: `Session interrompue sur ${device.name} : appareil injoignable`,
            });
          }
        }
      } else if (device.status === "OFFLINE") {
        if (Math.random() < CHANCE_RECONNECT) {
          await db.device.update({
            where: { id: device.id },
            data: { status: "ONLINE", lastSeenAt: now },
          });
          await recordAudit({
            actor: "simulateur",
            action: "DEVICE_RECONNECTED",
            targetType: "DEVICE",
            targetId: device.id,
            decision: "ALLOWED",
            detail: `${device.name} a rétabli sa connexion`,
          });
        }
      }
    }

    // ——— 2. Prise en charge des commandes en attente
    const pending = await db.command.findMany({ where: { status: "PENDING" } });
    for (const command of pending) {
      if (now.getTime() - new Date(command.createdAt).getTime() > PENDING_DELAY_MS) {
        await db.command.update({ where: { id: command.id }, data: { status: "RUNNING" } });
      }
    }

    // ——— 3. Résolution des commandes en cours
    const running = await db.command.findMany({
      where: { status: "RUNNING" },
      include: { device: true },
    });
    for (const command of running) {
      if (now.getTime() - new Date(command.createdAt).getTime() <= RUNNING_DELAY_MS) continue;
      const device = command.device;

      if (device.status !== "ONLINE") {
        await db.command.update({
          where: { id: command.id },
          data: {
            status: "FAILED",
            executedAt: now,
            result: "Appareil injoignable — commande abandonnée",
          },
        });
        await recordAudit({
          actor: "simulateur",
          action: "COMMAND_FAILED",
          targetType: "COMMAND",
          targetId: command.id,
          decision: "ERROR",
          detail: `${command.name} : appareil injoignable (${device.name})`,
        });
        continue;
      }

      if (Math.random() < SUCCESS_RATE) {
        const result = successResult(command.name, command.payload, device.name);
        await db.command.update({
          where: { id: command.id },
          data: { status: "SUCCESS", executedAt: now, result },
        });
        await recordAudit({
          actor: "simulateur",
          action: "COMMAND_EXECUTED",
          targetType: "COMMAND",
          targetId: command.id,
          decision: "ALLOWED",
          detail: `${command.name} exécutée avec succès sur ${device.name}`,
        });
        if (command.name === "REBOOT") {
          await db.device.update({
            where: { id: device.id },
            data: { status: "OFFLINE" },
          });
          await recordAudit({
            actor: "simulateur",
            action: "DEVICE_REBOOTING",
            targetType: "DEVICE",
            targetId: device.id,
            decision: "ALLOWED",
            detail: `${device.name} redémarre après commande distante`,
          });
        }
      } else {
        const result =
          FAILURE_RESULTS[Math.floor(Math.random() * FAILURE_RESULTS.length)] ?? "Échec inconnu";
        await db.command.update({
          where: { id: command.id },
          data: { status: "FAILED", executedAt: now, result },
        });
        await recordAudit({
          actor: "simulateur",
          action: "COMMAND_FAILED",
          targetType: "COMMAND",
          targetId: command.id,
          decision: "ERROR",
          detail: `${command.name} : ${result} (${device.name})`,
        });
      }
    }
  } finally {
    ticking = false;
  }
}
