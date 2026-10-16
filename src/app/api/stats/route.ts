import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { AuditEvent, DeviceStatus, Stats } from "@/lib/types";
import type { AuditDecision, AuditTargetType } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    devices,
    activeSessions,
    sessions24h,
    pendingCommands,
    runningCommands,
    success24h,
    failed24h,
    refused24h,
    deviceList,
    auditRecent,
  ] = await Promise.all([
    db.device.findMany(),
    db.session.count({ where: { status: "ACTIVE" } }),
    db.session.count({ where: { startedAt: { gte: since24h } } }),
    db.command.count({ where: { status: "PENDING" } }),
    db.command.count({ where: { status: "RUNNING" } }),
    db.command.count({ where: { status: "SUCCESS", executedAt: { gte: since24h } } }),
    db.command.count({ where: { status: "FAILED", createdAt: { gte: since24h } } }),
    db.command.count({ where: { status: "REFUSED", createdAt: { gte: since24h } } }),
    db.device.findMany({
      select: { id: true, name: true, status: true, authorized: true },
      orderBy: { createdAt: "asc" },
    }),
    db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const stats: Stats = {
    devices: {
      total: devices.length,
      online: devices.filter((d) => d.status === "ONLINE").length,
      offline: devices.filter((d) => d.status === "OFFLINE").length,
      pending: devices.filter((d) => d.status === "PENDING").length,
      revoked: devices.filter((d) => d.status === "REVOKED").length,
    },
    sessions: { active: activeSessions, total24h: sessions24h },
    commands: {
      pending: pendingCommands,
      running: runningCommands,
      success24h,
      failed24h,
      refused24h,
    },
    deviceList: deviceList.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status as DeviceStatus,
      authorized: d.authorized,
    })),
    auditRecent: auditRecent.map((event) => ({
      id: event.id,
      actor: event.actor,
      action: event.action,
      targetType: event.targetType as AuditTargetType,
      targetId: event.targetId,
      decision: event.decision as AuditDecision,
      detail: event.detail,
      ip: event.ip,
      // Sérialisation identique au JSON répondu (les routes Next.js convertissent
      // les Date en chaînes ISO) : le contrat côté client est respecté.
      createdAt: event.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(stats);
}
