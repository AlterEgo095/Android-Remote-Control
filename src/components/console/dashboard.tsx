"use client";

// Vue « Tableau de bord » : KPI, état des appareils, activité récente, avancement du plan.

import {
  Clock,
  MonitorPlay,
  ShieldAlert,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { Stats } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PHASES, PhaseStatusBadge } from "./plan";
import {
  DeviceStatusBadge,
  DecisionIcon,
  EmptyState,
  formatRelative,
  formatTime,
  statusDotClass,
} from "./ui-helpers";

interface DashboardViewProps {
  stats: Stats | null;
  onGoDevices: () => void;
  onGoAudit: () => void;
}

// ————————————————————————————————————————————————————————————
// KPI
// ————————————————————————————————————————————————————————————

const TONE_BADGE_CLASS: Record<"emerald" | "amber" | "red" | "zinc", string> = {
  emerald: "bg-emerald-500/10 text-emerald-400",
  amber: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  zinc: "bg-zinc-500/10 text-zinc-400",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TONE_BADGE_CLASS;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", TONE_BADGE_CLASS[tone])}>
          <Icon className="size-4" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}

// ————————————————————————————————————————————————————————————
// Vue
// ————————————————————————————————————————————————————————————

export function DashboardView({ stats, onGoDevices, onGoAudit }: DashboardViewProps) {
  if (!stats) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const queued = stats.commands.pending + stats.commands.running;
  const incidents = stats.commands.refused24h + stats.commands.failed24h;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Wifi}
          label="Appareils en ligne"
          value={`${stats.devices.online} / ${stats.devices.total}`}
          sub={`${stats.devices.pending} en attente · ${stats.devices.revoked} révoqué(s)`}
          tone="emerald"
        />
        <KpiCard
          icon={MonitorPlay}
          label="Sessions actives"
          value={String(stats.sessions.active)}
          sub={`${stats.sessions.total24h} session(s) sur 24 h`}
          tone="amber"
        />
        <KpiCard
          icon={Clock}
          label="Commandes en file"
          value={String(queued)}
          sub={`${stats.commands.pending} en attente · ${stats.commands.running} en cours`}
          tone="zinc"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Refus & échecs (24 h)"
          value={String(incidents)}
          sub={`${stats.commands.refused24h} refusée(s) · ${stats.commands.failed24h} échec(s)`}
          tone="red"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* État des appareils */}
        <Card>
          <CardHeader>
            <CardTitle>État des appareils</CardTitle>
            <CardDescription>{stats.deviceList.length} appareil(s) enregistré(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.deviceList.length === 0 ? (
              <EmptyState message="Aucun appareil enregistré pour le moment" />
            ) : (
              <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto pr-1">
                {stats.deviceList.map((device) => (
                  <li key={device.id}>
                    <button
                      type="button"
                      onClick={onGoDevices}
                      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-2 text-left transition-colors hover:bg-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            statusDotClass(device.status),
                            device.status === "ONLINE" && "animate-pulse",
                          )}
                          aria-hidden
                        />
                        <span className="truncate text-sm">{device.name}</span>
                      </span>
                      <DeviceStatusBadge status={device.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>8 derniers événements d&apos;audit</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={onGoAudit}>
              Voir tout
            </Button>
          </CardHeader>
          <CardContent>
            {stats.auditRecent.length === 0 ? (
              <EmptyState message="Aucun événement journalisé" />
            ) : (
              <ul className="flex max-h-72 flex-col divide-y overflow-y-auto pr-1">
                {stats.auditRecent.slice(0, 8).map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5 py-2.5">
                    <DecisionIcon decision={event.decision} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{event.action}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {event.detail || "—"}
                      </p>
                    </div>
                    <time
                      dateTime={event.createdAt}
                      className="shrink-0 font-mono text-xs text-muted-foreground"
                    >
                      {formatTime(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan de réalisation */}
      <Card>
        <CardHeader>
          <CardTitle>Plan de réalisation</CardTitle>
          <CardDescription>
            Avancement global — la phase 04 (console d&apos;administration) est matérialisée par ce prototype.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {PHASES.map((phase) => (
            <div key={phase.num} className="flex items-center gap-3">
              <Badge variant="outline" className="w-9 justify-center font-mono">
                {phase.num}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{phase.title}</span>
              <PhaseStatusBadge status={phase.status} />
            </div>
          ))}
          <div className="mt-2">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Avancement global</span>
              <span>~40 %</span>
            </div>
            <Progress
              value={40}
              aria-label="Avancement global du plan : environ 40 %"
              className="bg-emerald-500/15 [&>[data-slot=progress-indicator]]:bg-emerald-500"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
