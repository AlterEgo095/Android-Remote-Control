"use client";

// Vue « Commandes » : registre des 8 commandes autorisées, émission avec payload
// dynamique, avertissements de risque et tableau des commandes.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  AppWindow,
  Camera,
  Keyboard,
  Lock,
  MonitorUp,
  MousePointerClick,
  Move,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Command, Device } from "@/lib/types";
import { COMMAND_REGISTRY } from "@/lib/commands-registry";
import { apiFetch, getErrorMessage } from "@/hooks/use-console-data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CommandStatusBadge,
  EmptyState,
  ListSkeleton,
  RiskBadge,
  formatTime,
} from "./ui-helpers";

interface CommandsViewProps {
  commands: Command[] | null;
  devices: Device[] | null;
  refreshAll: () => Promise<void>;
}

const COMMAND_ICONS: Record<string, LucideIcon> = {
  SCREEN_VIEW: MonitorUp,
  SCREENSHOT: Camera,
  APP_LAUNCH: AppWindow,
  TEXT_INPUT: Keyboard,
  TAP: MousePointerClick,
  SWIPE: Move,
  LOCK: Lock,
  REBOOT: RotateCcw,
};

type SwipeDirection = "HAUT" | "BAS" | "GAUCHE" | "DROITE";

export function CommandsView({ commands, devices, refreshAll }: CommandsViewProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deviceId, setDeviceId] = useState("");
  const [commandName, setCommandName] = useState("");

  // Champs de payload dynamiques
  const [textInput, setTextInput] = useState("");
  const [packageName, setPackageName] = useState("");
  const [tapX, setTapX] = useState("");
  const [tapY, setTapY] = useState("");
  const [swipeDir, setSwipeDir] = useState<SwipeDirection | "">("");

  const selectedEntry = useMemo(
    () => COMMAND_REGISTRY.find((entry) => entry.name === commandName),
    [commandName],
  );

  const authorizedDevices = useMemo(
    () => (devices ?? []).filter((device) => device.authorized),
    [devices],
  );

  function resetForm() {
    setDeviceId("");
    setCommandName("");
    setTextInput("");
    setPackageName("");
    setTapX("");
    setTapY("");
    setSwipeDir("");
  }

  function buildPayload(): Record<string, unknown> | undefined {
    switch (selectedEntry?.name) {
      case "TEXT_INPUT":
        return textInput.trim() ? { text: textInput.trim() } : undefined;
      case "APP_LAUNCH":
        return packageName.trim() ? { package: packageName.trim() } : undefined;
      case "TAP": {
        const x = Number(tapX);
        const y = Number(tapY);
        return tapX !== "" && tapY !== "" && Number.isFinite(x) && Number.isFinite(y)
          ? { x, y }
          : undefined;
      }
      case "SWIPE":
        return swipeDir ? { dir: swipeDir } : undefined;
      default:
        return undefined;
    }
  }

  async function handleEmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!deviceId) {
      toast.error("Sélectionnez un appareil");
      return;
    }
    if (!selectedEntry) {
      toast.error("Sélectionnez une commande");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const created = await apiFetch<Command>("/api/commands", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          name: selectedEntry.name,
          ...(payload ? { payload } : {}),
        }),
      });
      if (created.status === "REFUSED") {
        toast.warning("Commande refusée", {
          description: created.result || "La commande a été refusée par la politique de sécurité.",
        });
      } else {
        toast.success("Commande émise");
      }
      setOpen(false);
      resetForm();
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Commandes</h2>
          <p className="text-sm text-muted-foreground">
            {commands ? `${commands.length} commande(s) enregistrée(s)` : "Chargement…"}
          </p>
        </div>
        <Button
          className="h-10 bg-emerald-600 text-white hover:bg-emerald-500 md:justify-self-end"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Émettre une commande
        </Button>
      </div>

      {/* Registre */}
      <Card>
        <CardHeader>
          <CardTitle>Registre des commandes autorisées</CardTitle>
          <CardDescription>
            Seules ces commandes peuvent être émises — toute autre demande est refusée et journalisée.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {COMMAND_REGISTRY.map((entry) => {
            const Icon = COMMAND_ICONS[entry.name] ?? ShieldAlert;
            return (
              <div
                key={entry.name}
                className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center"
                title={entry.description}
              >
                <Icon className="size-4 text-emerald-400" aria-hidden />
                <span className="text-xs font-medium leading-tight">{entry.label}</span>
                <RiskBadge risk={entry.risk} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des commandes</CardTitle>
          <CardDescription>
            Statuts mis à jour automatiquement par le moteur de simulation (4 s).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {commands === null ? (
            <div className="p-4">
              <ListSkeleton rows={6} />
            </div>
          ) : (
            <div className="max-h-[440px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Appareil</TableHead>
                    <TableHead>Commande</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Résultat</TableHead>
                    <TableHead className="hidden md:table-cell">Exécutée à</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commands.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState message="Aucune commande émise pour le moment" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    commands.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell className="font-mono text-xs">
                          {formatTime(command.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className="truncate text-sm">
                            {command.device?.name ?? "Appareil supprimé"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm">
                              {COMMAND_REGISTRY.find((entry) => entry.name === command.name)
                                ?.label ?? command.name}
                            </span>
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {command.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <CommandStatusBadge status={command.status} />
                        </TableCell>
                        <TableCell className="hidden max-w-[260px] md:table-cell">
                          <span className="block truncate text-xs text-muted-foreground">
                            {command.result || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs md:table-cell">
                          {command.executedAt ? formatTime(command.executedAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'émission */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Émettre une commande</DialogTitle>
            <DialogDescription>
              La commande est soumise au registre : un appareil non autorisé ou une commande
              inconnue sera refusée et journalisée.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="command-device">Appareil cible</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger id="command-device" className="h-10 w-full">
                  <SelectValue placeholder="Sélectionner un appareil autorisé" />
                </SelectTrigger>
                <SelectContent>
                  {authorizedDevices.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Aucun appareil autorisé pour le moment.
                    </div>
                  ) : (
                    authorizedDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name}
                        {device.status !== "ONLINE" ? " — hors ligne" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="command-name">Commande</Label>
              <Select value={commandName} onValueChange={setCommandName}>
                <SelectTrigger id="command-name" className="h-10 w-full">
                  <SelectValue placeholder="Sélectionner une commande du registre" />
                </SelectTrigger>
                <SelectContent>
                  {COMMAND_REGISTRY.map((entry) => {
                    const Icon = COMMAND_ICONS[entry.name] ?? ShieldAlert;
                    return (
                      <SelectItem key={entry.name} value={entry.name}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                          {entry.label}
                          <RiskBadge risk={entry.risk} />
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedEntry && (
                <p className="text-xs text-muted-foreground">{selectedEntry.description}</p>
              )}
            </div>

            {/* Payload dynamique */}
            {selectedEntry?.name === "TEXT_INPUT" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="payload-text">Texte à saisir</Label>
                <Textarea
                  id="payload-text"
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  placeholder="Message à injecter dans le champ actif…"
                  rows={3}
                />
              </div>
            )}
            {selectedEntry?.name === "APP_LAUNCH" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="payload-package">Identifiant de paquet</Label>
                <Input
                  id="payload-package"
                  value={packageName}
                  onChange={(event) => setPackageName(event.target.value)}
                  placeholder="ex. com.exemple.app"
                  className="font-mono"
                />
              </div>
            )}
            {selectedEntry?.name === "TAP" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payload-x">Coordonnée X (px)</Label>
                  <Input
                    id="payload-x"
                    type="number"
                    min={0}
                    value={tapX}
                    onChange={(event) => setTapX(event.target.value)}
                    placeholder="540"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payload-y">Coordonnée Y (px)</Label>
                  <Input
                    id="payload-y"
                    type="number"
                    min={0}
                    value={tapY}
                    onChange={(event) => setTapY(event.target.value)}
                    placeholder="1200"
                  />
                </div>
              </div>
            )}
            {selectedEntry?.name === "SWIPE" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="payload-dir">Direction du balayage</Label>
                <Select value={swipeDir} onValueChange={(value) => setSwipeDir(value as SwipeDirection)}>
                  <SelectTrigger id="payload-dir" className="h-10 w-full">
                    <SelectValue placeholder="Choisir une direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HAUT">Haut</SelectItem>
                    <SelectItem value="BAS">Bas</SelectItem>
                    <SelectItem value="GAUCHE">Gauche</SelectItem>
                    <SelectItem value="DROITE">Droite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Avertissements */}
            {selectedEntry?.requiresControl && (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-300">
                <AlertTriangle className="size-4 text-amber-400" aria-hidden />
                <AlertTitle>Session de contrôle requise</AlertTitle>
                <AlertDescription className="text-amber-200/80">
                  Cette commande nécessite une session de contrôle active sur l&apos;appareil.
                </AlertDescription>
              </Alert>
            )}
            {selectedEntry?.name === "REBOOT" && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" aria-hidden />
                <AlertTitle>Opération intrusive</AlertTitle>
                <AlertDescription>
                  L&apos;appareil redémarrera et la session en cours sera interrompue.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={submitting}
              >
                <Send className="size-4" aria-hidden />
                Émettre
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
