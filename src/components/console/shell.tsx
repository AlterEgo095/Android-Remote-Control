"use client";

// Shell de la console : header sticky, navigation (sidebar desktop + onglets mobile),
// zone principale animée (framer-motion) et footer collé en bas.

import { useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MonitorPlay,
  MonitorSmartphone,
  ScrollText,
  ShieldAlert,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import type {
  ArcMode,
  AuditEvent,
  AuthUser,
  Command,
  Device,
  Session,
  Stats,
} from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuditView } from "./audit-log";
import { CommandsView } from "./commands";
import { DashboardView } from "./dashboard";
import { DevicesView } from "./devices";
import { PlanView } from "./plan";
import { SessionsView } from "./sessions";

export type ConsoleView =
  | "dashboard"
  | "devices"
  | "sessions"
  | "commands"
  | "audit"
  | "plan";

const NAV_ITEMS: { id: ConsoleView; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "devices", label: "Appareils", icon: Smartphone },
  { id: "sessions", label: "Sessions", icon: MonitorPlay },
  { id: "commands", label: "Commandes", icon: ListChecks },
  { id: "audit", label: "Journal d'audit", icon: ScrollText },
  { id: "plan", label: "Plan & décisions", icon: ClipboardList },
];

interface ConsoleShellProps {
  user: AuthUser;
  mode: ArcMode | null;
  onLogout: () => void;
  stats: Stats | null;
  devices: Device[] | null;
  sessions: Session[] | null;
  commands: Command[] | null;
  audit: AuditEvent[] | null;
  refreshAll: () => Promise<void>;
}

export function ConsoleShell({
  user,
  mode,
  onLogout,
  stats,
  devices,
  sessions,
  commands,
  audit,
  refreshAll,
}: ConsoleShellProps) {
  const [view, setView] = useState<ConsoleView>("dashboard");

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ——— Header ——— */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <MonitorSmartphone className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold md:text-base">
                  Android Remote Control
                </h1>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  v1.0
                </Badge>
                {mode === "production" ? (
                  <Badge
                    variant="outline"
                    className="hidden border-emerald-500/40 text-emerald-400 md:inline-flex"
                  >
                    Production — intégration terminal à connecter
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="hidden border-amber-500/40 text-amber-400 md:inline-flex"
                  >
                    Simulation — données simulées
                  </Badge>
                )}
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Console d&apos;administration
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3">
              <Avatar className="size-7">
                <AvatarFallback className="bg-emerald-500/15 text-[10px] font-semibold text-emerald-400">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-xs font-medium">{user.username}</span>
                <span className="text-[10px] text-muted-foreground">{user.role}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={onLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      {/* ——— Navigation mobile ——— */}
      <nav
        className="border-b bg-background/95 lg:hidden"
        aria-label="Navigation principale (mobile)"
      >
        <div className="flex gap-1 overflow-x-auto px-2 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition-colors",
                view === item.id
                  ? "bg-emerald-500/10 font-medium text-emerald-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ——— Corps ——— */}
      <div className="flex w-full flex-1">
        {/* Sidebar desktop */}
        <aside
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col gap-1 border-r p-3 lg:flex"
          aria-label="Navigation principale"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={cn(
                "flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                view === item.id
                  ? "bg-emerald-500/10 font-medium text-emerald-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </button>
          ))}
        </aside>

        {/* Contenu */}
        <main className="w-full flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">
            {mode === "production" && (
              <Alert className="mb-4 border-amber-500/40 bg-amber-500/5">
                <ShieldAlert className="size-4 text-amber-400" aria-hidden />
                <AlertDescription className="text-amber-200/90">
                  <span className="font-semibold text-amber-300">Mode production — intégration terminal indisponible.</span>{" "}
                  L&apos;agent Android et la signalisation RustDesk ne sont pas encore connectés : aucune
                  session réelle ne peut être ouverte et aucune commande ne peut être exécutée. Les
                  données affichées proviennent uniquement des opérations manuelles enregistrées.
                </AlertDescription>
              </Alert>
            )}
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {view === "dashboard" && (
                <DashboardView
                  stats={stats}
                  onGoDevices={() => setView("devices")}
                  onGoAudit={() => setView("audit")}
                />
              )}
              {view === "devices" && <DevicesView devices={devices} refreshAll={refreshAll} />}
              {view === "sessions" && (
                <SessionsView sessions={sessions} devices={devices} refreshAll={refreshAll} />
              )}
              {view === "commands" && (
                <CommandsView commands={commands} devices={devices} refreshAll={refreshAll} />
              )}
              {view === "audit" && <AuditView audit={audit} />}
              {view === "plan" && <PlanView />}
            </motion.div>
          </div>
        </main>
      </div>

      {/* ——— Footer ——— */}
      <footer className="mt-auto border-t px-4 py-3 text-center text-xs text-muted-foreground">
        Android Remote Control v1.0 · Console d&apos;administration ·{" "}
        {mode === "production"
          ? "Mode production — intégration terminal (agent Android + RustDesk) à connecter"
          : "Prototype de console d'administration — signalisation & relais RustDesk simulés"}{" "}
        · Next.js + API + Prisma (SQLite, PostgreSQL en production) · Fuseau horaire :{" "}
        Africa/Kinshasa (UTC+1)
      </footer>
    </div>
  );
}
