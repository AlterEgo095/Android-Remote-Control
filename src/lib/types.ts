// Types de contrat partagés — Android Remote Control v1.0
// Backend (API routes) et frontend consomment exactement ces formes.

export type DeviceStatus = "ONLINE" | "OFFLINE" | "PENDING" | "REVOKED";
export type SessionKind = "OBSERVE" | "CONTROL";
export type SessionStatus = "ACTIVE" | "CLOSED" | "FAILED";
export type CommandStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "REFUSED";
export type AuditDecision = "ALLOWED" | "DENIED" | "ERROR";
export type AuditTargetType = "DEVICE" | "SESSION" | "COMMAND" | "SYSTEM";

/** Mode d'exécution de la plateforme (voir src/lib/config.ts). */
export type ArcMode = "simulation" | "production";

export interface Device {
  id: string;
  name: string;
  model: string;
  osVersion: string;
  rustdeskId: string;
  status: DeviceStatus;
  authorized: boolean;
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { sessions: number; commands: number };
}

export interface Session {
  id: string;
  deviceId: string;
  kind: SessionKind;
  status: SessionStatus;
  sourceIp: string | null;
  startedAt: string;
  endedAt: string | null;
  device?: { id: string; name: string; rustdeskId: string };
}

export interface Command {
  id: string;
  deviceId: string;
  sessionId?: string | null;
  name: string;
  payload?: string | null;
  status: CommandStatus;
  result?: string | null;
  createdAt: string;
  executedAt?: string | null;
  device?: { id: string; name: string; rustdeskId: string };
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  targetType: AuditTargetType;
  targetId?: string | null;
  decision: AuditDecision;
  detail?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface Stats {
  devices: { total: number; online: number; offline: number; pending: number; revoked: number };
  sessions: { active: number; total24h: number };
  commands: { pending: number; running: number; success24h: number; failed24h: number; refused24h: number };
  deviceList: { id: string; name: string; status: DeviceStatus; authorized: boolean }[];
  auditRecent: AuditEvent[];
}

export interface RegistryEntry {
  name: string;
  label: string;
  description: string;
  risk: "FAIBLE" | "MODERE" | "ELEVE";
  requiresControl: boolean;
  payloadHint?: string | null;
}

export interface AuthUser {
  username: string;
  role: string;
}
