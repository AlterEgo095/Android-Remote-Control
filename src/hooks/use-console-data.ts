"use client";

// Hook central de la console : authentification, chargements, polling (4 s),
// moteur de simulation (tick) et gestion 401 globale.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AuditEvent,
  AuthUser,
  Command,
  Device,
  Session,
  Stats,
} from "@/lib/types";

const UNAUTHORIZED_EVENT = "arc:unauthorized";
const POLL_INTERVAL_MS = 4000;

/** Message lisible depuis une erreur quelconque. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inattendue";
}

export interface DeviceDetail {
  device: Device;
  sessions: Session[];
  commands: Command[];
}

/**
 * Requête same-origin (cookies automatiques).
 * - 401 → notifie la déconnexion globale puis lève une erreur.
 * - !ok → lève Error(json.error || "Erreur inattendue").
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Impossible de contacter le serveur");
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  const serverError =
    payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : null;

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new Error(serverError ?? "Session expirée");
  }
  if (!res.ok) {
    throw new Error(serverError ?? "Erreur inattendue");
  }
  return payload as T;
}

export function useConsoleData() {
  const [bootLoading, setBootLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [commands, setCommands] = useState<Command[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);

  // ——— Vérification de session au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = (await res.json()) as { user: AuthUser };
          if (!cancelled) setUser(data.user);
        }
      } catch {
        // Serveur injoignable : on reste sur l'écran de connexion.
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ——— Toute réponse 401 ramène à l'écran de connexion
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  const loadStats = useCallback(async (silent = true) => {
    try {
      setStats(await apiFetch<Stats>("/api/stats"));
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    }
  }, []);

  const loadDevices = useCallback(async (silent = true) => {
    try {
      setDevices(await apiFetch<Device[]>("/api/devices"));
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    }
  }, []);

  const loadSessions = useCallback(async (silent = true) => {
    try {
      setSessions(await apiFetch<Session[]>("/api/sessions"));
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    }
  }, []);

  const loadCommands = useCallback(async (silent = true) => {
    try {
      setCommands(await apiFetch<Command[]>("/api/commands"));
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    }
  }, []);

  const loadAudit = useCallback(async (silent = true) => {
    try {
      setAudit(await apiFetch<AuditEvent[]>("/api/audit"));
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    }
  }, []);

  const refreshAll = useCallback(
    async (silent = true) => {
      await Promise.allSettled([
        loadStats(silent),
        loadDevices(silent),
        loadSessions(silent),
        loadCommands(silent),
        loadAudit(silent),
      ]);
    },
    [loadStats, loadDevices, loadSessions, loadCommands, loadAudit],
  );

  // ——— Polling : tick simulateur + rechargement des GET toutes les 4 s
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void refreshAll(false); // premier chargement (erreurs visibles)

    const id = setInterval(() => {
      void (async () => {
        try {
          await fetch("/api/simulator/tick", { method: "POST" });
        } catch {
          // Simulateur indisponible : on continue à rafraîchir les données.
        }
        if (!cancelled) void refreshAll(true);
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, refreshAll]);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // On déconnecte localement quoi qu'il arrive.
    }
    setUser(null);
    setStats(null);
    setDevices(null);
    setSessions(null);
    setCommands(null);
    setAudit(null);
  }, []);

  return {
    bootLoading,
    user,
    login,
    logout,
    stats,
    devices,
    sessions,
    commands,
    audit,
    refreshAll: () => refreshAll(true),
  };
}
