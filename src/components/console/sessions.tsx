"use client";

// Vue « Sessions » : ouverture (observation / contrôle), tableau des sessions,
// durée live pour les sessions actives, clôture manuelle.

import { useMemo, useState } from "react";
import { Info, MonitorPlay, MousePointerClick, Plus, Square } from "lucide-react";
import { toast } from "sonner";
import type { Device, Session, SessionKind } from "@/lib/types";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ListSkeleton,
  SessionKindBadge,
  SessionStatusBadge,
  formatDateTime,
  formatDuration,
  formatRelative,
} from "./ui-helpers";

interface SessionsViewProps {
  sessions: Session[] | null;
  devices: Device[] | null;
  refreshAll: () => Promise<void>;
}

function sessionDurationLabel(session: Session): string {
  const start = new Date(session.startedAt).getTime();
  if (Number.isNaN(start)) return "—";
  const end =
    session.status === "ACTIVE"
      ? Date.now()
      : session.endedAt
        ? new Date(session.endedAt).getTime()
        : NaN;
  if (Number.isNaN(end)) return "—";
  return formatDuration(end - start);
}

export function SessionsView({ sessions, devices, refreshAll }: SessionsViewProps) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [kind, setKind] = useState<SessionKind>("OBSERVE");
  const [submitting, setSubmitting] = useState(false);

  const authorizedDevices = useMemo(
    () => (devices ?? []).filter((device) => device.authorized),
    [devices],
  );

  async function handleOpenSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!deviceId) {
      toast.error("Sélectionnez un appareil");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch<Session>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ deviceId, kind }),
      });
      toast.success("Session ouverte — flux RustDesk simulé");
      setOpen(false);
      setDeviceId("");
      setKind("OBSERVE");
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(session: Session) {
    try {
      await apiFetch<Session>(`/api/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "close" }),
      });
      toast.success("Session terminée");
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sessions</h2>
          <p className="text-sm text-muted-foreground">
            {sessions ? `${sessions.length} session(s) enregistrée(s)` : "Chargement…"}
          </p>
        </div>
        <Button
          className="h-10 bg-emerald-600 text-white hover:bg-emerald-500 md:justify-self-end"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle session
        </Button>
      </div>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des sessions</CardTitle>
          <CardDescription>
            Les sessions actives sont recalculées à chaque rafraîchissement (4 s).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sessions === null ? (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appareil</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Début</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead className="hidden lg:table-cell">IP source</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState message="Aucune session — ouvrez une session depuis un appareil autorisé" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">
                              {session.device?.name ?? "Appareil supprimé"}
                            </span>
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {session.device?.rustdeskId ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <SessionKindBadge kind={session.kind} />
                        </TableCell>
                        <TableCell>
                          <SessionStatusBadge status={session.status} />
                        </TableCell>
                        <TableCell className="hidden text-sm md:table-cell">
                          {formatDateTime(session.startedAt)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {sessionDurationLabel(session)}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs lg:table-cell">
                          {session.sourceIp ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {session.status === "ACTIVE" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 min-w-10"
                              onClick={() => void handleClose(session)}
                              aria-label={`Terminer la session de ${session.device?.name ?? "l'appareil"}`}
                            >
                              <Square className="size-3.5" aria-hidden />
                              Terminer
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {formatRelative(session.endedAt)}
                            </span>
                          )}
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

      {/* Rappel architectural */}
      <Alert>
        <Info className="size-4" aria-hidden />
        <AlertTitle>Rappel — RustDesk et la console</AlertTitle>
        <AlertDescription>
          L&apos;affichage d&apos;un identifiant RustDesk ne vaut pas session de contrôle : le flux
          visuel dépend de l&apos;intégration RustDesk prévue en phase 02.
        </AlertDescription>
      </Alert>

      {/* Dialog nouvelle session */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setDeviceId("");
            setKind("OBSERVE");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle session</DialogTitle>
            <DialogDescription>
              Ouvrir une session administrative sur un appareil autorisé et en ligne.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOpenSession} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-device">Appareil</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger id="session-device" className="h-10 w-full">
                  <SelectValue placeholder="Sélectionner un appareil" />
                </SelectTrigger>
                <SelectContent>
                  {authorizedDevices.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Aucun appareil autorisé pour le moment.
                    </div>
                  ) : (
                    authorizedDevices.map((device) => (
                      <SelectItem
                        key={device.id}
                        value={device.id}
                        disabled={device.status !== "ONLINE"}
                      >
                        {device.name}
                        {device.status !== "ONLINE" ? " — hors ligne" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Type de session</Label>
              <RadioGroup
                value={kind}
                onValueChange={(value) => setKind(value as SessionKind)}
                className="gap-2"
              >
                <Label
                  htmlFor="kind-observe"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50",
                    kind === "OBSERVE" && "border-emerald-500/50 bg-emerald-500/5",
                  )}
                >
                  <RadioGroupItem value="OBSERVE" id="kind-observe" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <MonitorPlay className="size-4 text-emerald-400" aria-hidden />
                      Observation (lecture seule)
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Visualiser l&apos;écran sans interagir avec l&apos;appareil.
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="kind-control"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50",
                    kind === "CONTROL" && "border-amber-500/50 bg-amber-500/5",
                  )}
                >
                  <RadioGroupItem value="CONTROL" id="kind-control" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <MousePointerClick className="size-4 text-amber-400" aria-hidden />
                      Contrôle (interactions compatibles)
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Autorise les commandes nécessitant une session de contrôle active.
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={submitting}
              >
                Ouvrir la session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
