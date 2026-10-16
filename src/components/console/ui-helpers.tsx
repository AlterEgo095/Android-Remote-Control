"use client";

// Helpers UI partagés de la console : formats (heure Kinshasa, durées relatives)
// et badges de statut / décision / risque, dans la palette sombre emerald-amber-red.

import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  ShieldX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  AuditDecision,
  AuditTargetType,
  CommandStatus,
  DeviceStatus,
  SessionKind,
  SessionStatus,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ————————————————————————————————————————————————————————————
// Palette
// ————————————————————————————————————————————————————————————

export const TONE_CLASS = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
  zinc: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
} as const;

// ————————————————————————————————————————————————————————————
// Formats horaires (fuseau Africa/Kinshasa)
// ————————————————————————————————————————————————————————————

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Kinshasa",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Kinshasa",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12/05/2025 14:32:07" (Africa/Kinshasa) */
export function formatDateTime(iso: string | null | undefined): string {
  const date = safeDate(iso);
  return date ? dateTimeFormatter.format(date) : "—";
}

/** "14:32:07" (Africa/Kinshasa) */
export function formatTime(iso: string | null | undefined): string {
  const date = safeDate(iso);
  return date ? timeFormatter.format(date) : "—";
}

/** "il y a 3 minutes" (date-fns, locale fr) */
export function formatRelative(iso: string | null | undefined): string {
  const date = safeDate(iso);
  if (!date) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: fr });
}

/** Durée humanisée : "1 h 02 min", "3 min 05 s", "42 s" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  return `${seconds} s`;
}

// ————————————————————————————————————————————————————————————
// Puce de statut colorée
// ————————————————————————————————————————————————————————————

export function statusDotClass(status: DeviceStatus): string {
  switch (status) {
    case "ONLINE":
      return "bg-emerald-400";
    case "PENDING":
      return "bg-amber-400";
    case "REVOKED":
      return "bg-red-400";
    default:
      return "bg-zinc-500";
  }
}

function PulsingDot({ className }: { className?: string }) {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
          className,
        )}
      />
      <span className={cn("relative inline-flex size-2 rounded-full", className)} />
    </span>
  );
}

// ————————————————————————————————————————————————————————————
// Badges
// ————————————————————————————————————————————————————————————

const DEVICE_STATUS_META: Record<DeviceStatus, { label: string; tone: keyof typeof TONE_CLASS; pulse?: boolean }> = {
  ONLINE: { label: "En ligne", tone: "emerald", pulse: true },
  OFFLINE: { label: "Hors ligne", tone: "zinc" },
  PENDING: { label: "En attente", tone: "amber" },
  REVOKED: { label: "Révoqué", tone: "red" },
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const meta = DEVICE_STATUS_META[status];
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      {meta.pulse && <PulsingDot className="bg-emerald-400" />}
      {meta.label}
    </Badge>
  );
}

const SESSION_STATUS_META: Record<SessionStatus, { label: string; tone: keyof typeof TONE_CLASS; pulse?: boolean }> = {
  ACTIVE: { label: "Active", tone: "emerald", pulse: true },
  CLOSED: { label: "Fermée", tone: "zinc" },
  FAILED: { label: "Échec", tone: "red" },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const meta = SESSION_STATUS_META[status];
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      {meta.pulse && <PulsingDot className="bg-emerald-400" />}
      {meta.label}
    </Badge>
  );
}

const SESSION_KIND_META: Record<SessionKind, { label: string; tone: keyof typeof TONE_CLASS }> = {
  OBSERVE: { label: "Observation", tone: "emerald" },
  CONTROL: { label: "Contrôle", tone: "amber" },
};

export function SessionKindBadge({ kind }: { kind: SessionKind }) {
  const meta = SESSION_KIND_META[kind];
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      {meta.label}
    </Badge>
  );
}

const COMMAND_STATUS_META: Record<
  CommandStatus,
  { label: string; tone: keyof typeof TONE_CLASS; icon: LucideIcon; spin?: boolean }
> = {
  PENDING: { label: "En attente", tone: "zinc", icon: Clock },
  RUNNING: { label: "En cours", tone: "amber", icon: Loader2, spin: true },
  SUCCESS: { label: "Succès", tone: "emerald", icon: CheckCircle2 },
  FAILED: { label: "Échec", tone: "red", icon: XCircle },
  REFUSED: { label: "Refusée", tone: "red", icon: ShieldX },
};

export function CommandStatusBadge({ status }: { status: CommandStatus }) {
  const meta = COMMAND_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      <Icon className={cn("size-3", meta.spin && "animate-spin")} aria-hidden />
      {meta.label}
    </Badge>
  );
}

const RISK_META: Record<"FAIBLE" | "MODERE" | "ELEVE", { label: string; tone: keyof typeof TONE_CLASS }> = {
  FAIBLE: { label: "Faible", tone: "emerald" },
  MODERE: { label: "Modéré", tone: "amber" },
  ELEVE: { label: "Élevé", tone: "red" },
};

export function RiskBadge({ risk }: { risk: "FAIBLE" | "MODERE" | "ELEVE" }) {
  const meta = RISK_META[risk];
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", TONE_CLASS[meta.tone])}>
      {meta.label}
    </Badge>
  );
}

const DECISION_META: Record<AuditDecision, { label: string; tone: keyof typeof TONE_CLASS }> = {
  ALLOWED: { label: "Autorisé", tone: "emerald" },
  DENIED: { label: "Refusé", tone: "red" },
  ERROR: { label: "Erreur", tone: "amber" },
};

export function DecisionBadge({ decision }: { decision: AuditDecision }) {
  const meta = DECISION_META[decision];
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      {meta.label}
    </Badge>
  );
}

/** Icône de décision : succès emerald, refus red, erreur amber. */
export function DecisionIcon({
  decision,
  className,
}: {
  decision: AuditDecision;
  className?: string;
}) {
  if (decision === "ALLOWED") {
    return <CheckCircle2 className={cn("size-4 text-emerald-400", className)} aria-hidden />;
  }
  if (decision === "DENIED") {
    return <ShieldX className={cn("size-4 text-red-400", className)} aria-hidden />;
  }
  return <AlertTriangle className={cn("size-4 text-amber-400", className)} aria-hidden />;
}

const TARGET_TYPE_LABEL: Record<AuditTargetType, string> = {
  DEVICE: "Appareil",
  SESSION: "Session",
  COMMAND: "Commande",
  SYSTEM: "Système",
};

export function TargetTypeBadge({ targetType }: { targetType: AuditTargetType }) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {TARGET_TYPE_LABEL[targetType]}
    </Badge>
  );
}

// ————————————————————————————————————————————————————————————
// États vides & skeletons
// ————————————————————————————————————————————————————————————

export function EmptyState({
  icon: Icon = Inbox,
  message = "Aucun élément à afficher",
}: {
  icon?: LucideIcon;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Petit libellé de fiche (grille caractéristiques). */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm">{children}</span>
    </div>
  );
}
