"use client";

import { useEffect, useState } from "react";
import { Loader2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/hooks/use-console-data";
import type { ArcMode } from "@/lib/types";

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<ArcMode | null>(null);

  // Mode d'exécution public : l'encart de démonstration n'est affiché
  // qu'en simulation — jamais en production (aucun identifiant divulgué).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mode?: ArcMode } | null) => {
        if (!cancelled && data && (data.mode === "simulation" || data.mode === "production")) {
          setMode(data.mode);
        }
      })
      .catch(() => {
        // Config indisponible : on n'affiche aucun indice.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onLogin(username.trim(), password);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <MonitorSmartphone className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-lg font-semibold">Android Remote Control</CardTitle>
          <CardDescription>Console d&apos;administration — v1.0</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-username">Identifiant</Label>
              <Input
                id="login-username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Mot de passe</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button
              type="submit"
              className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Se connecter
            </Button>
          </form>

          {mode === "simulation" && (
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Démonstration — identifiants :{" "}
              <span className="font-mono text-foreground">admin</span> /{" "}
              <span className="font-mono text-foreground">Arc@2024!</span>
            </div>
          )}

          <div className="flex justify-center">
            {mode === "production" ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                Production — intégration terminal à connecter
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                Prototype — données simulées
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
