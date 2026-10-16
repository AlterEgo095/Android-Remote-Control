import { db } from "./db";
import type { AuditDecision, AuditTargetType } from "./types";

export interface AuditInput {
  actor: string;
  action: string;
  targetType: AuditTargetType;
  targetId?: string | null;
  decision: AuditDecision;
  detail?: string | null;
  ip?: string | null;
}

/** Enregistre un événement d'audit — toute action sensible doit y passer. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actor: input.actor,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        decision: input.decision,
        detail: input.detail ?? null,
        ip: input.ip ?? null,
      },
    });
  } catch {
    // L'audit ne doit jamais faire échouer l'action métier.
  }
}
