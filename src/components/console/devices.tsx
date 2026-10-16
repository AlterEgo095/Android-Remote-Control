"use client";

// Vue « Appareils » : recherche, enregistrement, tableau, fiche détaillée (Sheet),
// autorisation / révocation (AlertDialog) et ouverture de sessions.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  MonitorPlay,
  MoreHorizontal,
  MousePointerClick,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import type { Device, SessionKind } from "@/lib/types";
import {
  apiFetch,
  getErrorMessage,
  type DeviceDetail,
} from "@/hooks/use-console-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
  DeviceStatusBadge,
  EmptyState,
  Field,
  ListSkeleton,
  SessionKindBadge,
  SessionStatusBadge,
  formatDateTime,
  formatRelative,
} from "./ui-helpers";

interface DevicesViewProps {
  devices: Device[] | null;
  refreshAll: () => Promise<void>;
}

const EMPTY_FORM = {
  name: "",
  model: "",
  rustdeskId: "",
  osVersion: "Android 14",
  notes: "",
};

export function DevicesView({ devices, refreshAll }: DevicesViewProps) {
  // Recherche + enregistrement
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Fiche détaillée (Sheet)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Révocation (AlertDialog)
  const [revokeTarget, setRevokeTarget] = useState<Device | null>(null);

  const filtered = useMemo(() => {
    if (!devices) return [];
    const query = search.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter(
      (device) =>
        device.name.toLowerCase().includes(query) ||
        device.model.toLowerCase().includes(query) ||
        device.rustdeskId.toLowerCase().includes(query),
    );
  }, [devices, search]);

  const loadDetail = useCallback(async (id: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const data = await apiFetch<DeviceDetail>(`/api/devices/${id}`);
      setDetail(data);
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    } finally {
      if (!silent) setDetailLoading(false);
    }
  }, []);

  const openSheet = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDetail(null);
      void loadDetail(id, false);
    },
    [loadDetail],
  );

  // La fiche suit le polling général (4 s) tant qu'elle est ouverte.
  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(() => void loadDetail(selectedId, true), 4000);
    return () => clearInterval(id);
  }, [selectedId, loadDetail]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiFetch<Device>("/api/devices", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          model: form.model.trim(),
          rustdeskId: form.rustdeskId.trim(),
          osVersion: form.osVersion.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      toast.success("Appareil enregistré — en attente d'autorisation");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuthorize(device: Device) {
    try {
      await apiFetch<Device>(`/api/devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "authorize" }),
      });
      toast.success(`« ${device.name} » est maintenant autorisé`);
      await refreshAll();
      if (selectedId === device.id) void loadDetail(device.id, true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleRevoke(device: Device) {
    setRevokeTarget(null);
    try {
      await apiFetch<Device>(`/api/devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "revoke" }),
      });
      toast.success(`Accès révoqué pour « ${device.name} »`);
      await refreshAll();
      if (selectedId === device.id) void loadDetail(device.id, true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleStartSession(device: Device, kind: SessionKind) {
    try {
      await apiFetch("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ deviceId: device.id, kind }),
      });
      toast.success("Session ouverte — flux RustDesk simulé");
      await refreshAll();
      if (selectedId === device.id) void loadDetail(device.id, true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Appareils</h2>
          <p className="text-sm text-muted-foreground">
            {devices ? `${devices.length} appareil(s) enregistré(s)` : "Chargement…"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher nom, modèle ou ID RustDesk…"
              aria-label="Rechercher un appareil"
              className="h-10 pl-9 sm:w-72"
            />
          </div>
          <Button
            className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Enregistrer un appareil
          </Button>
        </div>
      </div>

      {/* Tableau */}
      <Card>
        <CardContent className="p-0">
          {devices === null ? (
            <div className="p-4">
              <ListSkeleton rows={6} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appareil</TableHead>
                  <TableHead className="hidden sm:table-cell">ID RustDesk</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="hidden md:table-cell">Autorisation</TableHead>
                  <TableHead className="hidden md:table-cell">Dernière activité</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState message="Aucun appareil ne correspond à la recherche" />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((device) => (
                    <TableRow
                      key={device.id}
                      className="cursor-pointer"
                      onClick={() => openSheet(device.id)}
                    >
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{device.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {device.model}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs sm:table-cell">
                        {device.rustdeskId}
                      </TableCell>
                      <TableCell>
                        <DeviceStatusBadge status={device.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {device.authorized ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          >
                            Autorisé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Non autorisé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatRelative(device.lastSeenAt)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-10"
                              aria-label={`Actions pour ${device.name}`}
                            >
                              <MoreHorizontal className="size-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => openSheet(device.id)}>
                              <Eye className="size-4" aria-hidden />
                              Ouvrir la fiche
                            </DropdownMenuItem>
                            {!device.authorized && (
                              <DropdownMenuItem onClick={() => void handleAuthorize(device)}>
                                <ShieldCheck className="size-4 text-emerald-400" aria-hidden />
                                Autoriser
                              </DropdownMenuItem>
                            )}
                            {device.authorized && (
                              <DropdownMenuItem
                                onClick={() => setRevokeTarget(device)}
                                className="text-red-400 focus:text-red-300"
                              >
                                <ShieldOff className="size-4" aria-hidden />
                                Révoquer
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => void handleStartSession(device, "OBSERVE")}
                            >
                              <MonitorPlay className="size-4" aria-hidden />
                              Session Observation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void handleStartSession(device, "CONTROL")}
                            >
                              <MousePointerClick className="size-4" aria-hidden />
                              Session Contrôle
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'enregistrement */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un appareil</DialogTitle>
            <DialogDescription>
              L&apos;appareil sera créé en attente d&apos;autorisation, sans accès aux sessions ni
              aux commandes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="device-name">Nom</Label>
              <Input
                id="device-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="ex. Téléphone atelier"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="device-model">Modèle</Label>
              <Input
                id="device-model"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="ex. Samsung Galaxy A54"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="device-rustdesk">ID RustDesk</Label>
              <Input
                id="device-rustdesk"
                value={form.rustdeskId}
                onChange={(event) => setForm({ ...form, rustdeskId: event.target.value })}
                placeholder="ex. 123 456 789"
                className="font-mono"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="device-os">Version Android</Label>
              <Input
                id="device-os"
                value={form.osVersion}
                onChange={(event) => setForm({ ...form, osVersion: event.target.value })}
                placeholder="Android 14"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="device-notes">Notes</Label>
              <Textarea
                id="device-notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Localisation, usage prévu, remarques…"
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={submitting}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sheet fiche détaillée */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
          {detailLoading && !detail ? (
            <div className="flex flex-col gap-3 p-4" aria-busy="true">
              <SheetTitle className="sr-only">Fiche appareil</SheetTitle>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : detail ? (
            <>
              <SheetHeader className="border-b p-4">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <SheetTitle className="text-base font-semibold">
                    {detail.device.name}
                  </SheetTitle>
                  <DeviceStatusBadge status={detail.device.status} />
                </div>
                <SheetDescription className="truncate">
                  {detail.device.model} · {detail.device.osVersion}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 p-4">
                {/* Caractéristiques */}
                <section className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="ID RustDesk">
                    <span className="font-mono text-xs">{detail.device.rustdeskId}</span>
                  </Field>
                  <Field label="Modèle">{detail.device.model}</Field>
                  <Field label="Système">{detail.device.osVersion}</Field>
                  <Field label="Enregistré le">{formatDateTime(detail.device.createdAt)}</Field>
                  <Field label="Dernière activité">
                    {formatRelative(detail.device.lastSeenAt)}
                  </Field>
                  <Field label="Autorisation">
                    {detail.device.authorized ? (
                      <span className="text-emerald-400">Autorisé</span>
                    ) : (
                      <span className="text-muted-foreground">Non autorisé</span>
                    )}
                  </Field>
                  <Field label="Sessions">{detail.device._count?.sessions ?? "—"}</Field>
                  <Field label="Commandes">{detail.device._count?.commands ?? "—"}</Field>
                </section>

                {/* Notes */}
                {detail.device.notes && (
                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-xs text-muted-foreground">Notes</h3>
                    <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
                      {detail.device.notes}
                    </p>
                  </section>
                )}

                {/* Actions */}
                <section className="flex flex-col gap-2.5">
                  <h3 className="text-sm font-medium">Actions</h3>
                  {detail.device.authorized ? (
                    <Button
                      variant="outline"
                      className="h-10 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => setRevokeTarget(detail.device)}
                    >
                      <ShieldOff className="size-4" aria-hidden />
                      Révoquer l&apos;accès
                    </Button>
                  ) : (
                    <Button
                      className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => void handleAuthorize(detail.device)}
                    >
                      <ShieldCheck className="size-4" aria-hidden />
                      Autoriser l&apos;appareil
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => void handleStartSession(detail.device, "OBSERVE")}
                    >
                      <MonitorPlay className="size-4" aria-hidden />
                      Session Observation
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => void handleStartSession(detail.device, "CONTROL")}
                    >
                      <MousePointerClick className="size-4" aria-hidden />
                      Session Contrôle
                    </Button>
                  </div>
                </section>

                {/* Sessions récentes */}
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Sessions récentes</h3>
                  {detail.sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune session enregistrée.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                      <ul className="divide-y">
                        {detail.sessions.slice(0, 5).map((session) => (
                          <li
                            key={session.id}
                            className="flex items-center justify-between gap-2 px-3 py-2.5"
                          >
                            <div className="flex min-w-0 flex-col gap-1">
                              <SessionKindBadge kind={session.kind} />
                              <span className="truncate text-xs text-muted-foreground">
                                {formatDateTime(session.startedAt)}
                              </span>
                            </div>
                            <SessionStatusBadge status={session.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                {/* Commandes récentes */}
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Commandes récentes</h3>
                  {detail.commands.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune commande émise.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                      <ul className="divide-y">
                        {detail.commands.slice(0, 5).map((command) => (
                          <li
                            key={command.id}
                            className="flex items-start justify-between gap-2 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs">{command.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {command.result || "—"}
                              </p>
                            </div>
                            <CommandStatusBadge status={command.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="p-4">
              <EmptyState message="Impossible de charger la fiche de l'appareil" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation de révocation */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l&apos;accès ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les sessions actives seront fermées et l&apos;appareil ne pourra plus être contacté
              via la plateforme de gestion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => revokeTarget && void handleRevoke(revokeTarget)}
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
