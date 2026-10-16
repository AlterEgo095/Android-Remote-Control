"use client";

// Point d'entrée unique de la console : vérifie la session au montage,
// affiche l'écran de connexion ou le shell complet.

import { Loader2 } from "lucide-react";
import { useConsoleData } from "@/hooks/use-console-data";
import { LoginScreen } from "@/components/console/login-screen";
import { ConsoleShell } from "@/components/console/shell";

export default function Home() {
  const {
    bootLoading,
    user,
    login,
    logout,
    stats,
    devices,
    sessions,
    commands,
    audit,
    refreshAll,
  } = useConsoleData();

  // Écran de chargement initial (vérification de session)
  if (bootLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="size-6 animate-spin text-emerald-400" aria-hidden />
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </div>
    );
  }

  // Non authentifié → écran de connexion
  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  // Authentifié → console complète
  return (
    <ConsoleShell
      user={user}
      onLogout={() => void logout()}
      stats={stats}
      devices={devices}
      sessions={sessions}
      commands={commands}
      audit={audit}
      refreshAll={refreshAll}
    />
  );
}
