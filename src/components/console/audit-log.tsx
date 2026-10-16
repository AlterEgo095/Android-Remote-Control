"use client";

// Vue « Journal d'audit » : filtres décision / type de cible (côté client) et
// table des 100 derniers événements.

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import type { AuditEvent, AuditDecision, AuditTargetType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DecisionBadge,
  DecisionIcon,
  EmptyState,
  ListSkeleton,
  TargetTypeBadge,
  formatDateTime,
} from "./ui-helpers";

interface AuditViewProps {
  audit: AuditEvent[] | null;
}

const DECISION_OPTIONS: { value: AuditDecision | "all"; label: string }[] = [
  { value: "all", label: "Toutes les décisions" },
  { value: "ALLOWED", label: "Autorisé" },
  { value: "DENIED", label: "Refusé" },
  { value: "ERROR", label: "Erreur" },
];

const TARGET_OPTIONS: { value: AuditTargetType | "all"; label: string }[] = [
  { value: "all", label: "Tous les types" },
  { value: "DEVICE", label: "Appareil" },
  { value: "SESSION", label: "Session" },
  { value: "COMMAND", label: "Commande" },
  { value: "SYSTEM", label: "Système" },
];

export function AuditView({ audit }: AuditViewProps) {
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (!audit) return [];
    return audit.filter(
      (event) =>
        (decisionFilter === "all" || event.decision === decisionFilter) &&
        (targetFilter === "all" || event.targetType === targetFilter),
    );
  }, [audit, decisionFilter, targetFilter]);

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div>
        <h2 className="text-lg font-semibold">Journal d&apos;audit</h2>
        <p className="text-sm text-muted-foreground">
          Traçabilité complète des actions administratives — 100 derniers événements.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Événements</CardTitle>
              <CardDescription>
                {audit
                  ? `${filtered.length} événement(s) sur ${audit.length} affiché(s)`
                  : "Chargement…"}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-decision">Décision</Label>
                <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                  <SelectTrigger id="audit-decision" className="h-10 w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECISION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-target">Type de cible</Label>
                <Select value={targetFilter} onValueChange={setTargetFilter}>
                  <SelectTrigger id="audit-target" className="h-10 w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="h-10 w-fit justify-center px-3 sm:w-32">
                {filtered.length} événement(s)
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {audit === null ? (
            <div className="p-4">
              <ListSkeleton rows={8} />
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horodatage</TableHead>
                    <TableHead>Acteur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">Cible</TableHead>
                    <TableHead>Décision</TableHead>
                    <TableHead className="hidden lg:table-cell">Détail</TableHead>
                    <TableHead className="hidden lg:table-cell">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState
                          icon={ScrollText}
                          message="Aucun événement ne correspond aux filtres sélectionnés"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {formatDateTime(event.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="max-w-28">
                            <span className="truncate">{event.actor}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DecisionIcon decision={event.decision} className="hidden size-4 shrink-0 sm:block" />
                            <span className="font-medium">{event.action}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <TargetTypeBadge targetType={event.targetType} />
                            <span className="font-mono text-xs text-muted-foreground">
                              {event.targetId ? event.targetId.slice(0, 8) : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DecisionBadge decision={event.decision} />
                        </TableCell>
                        <TableCell className="hidden max-w-[280px] lg:table-cell">
                          <span className="block truncate text-xs text-muted-foreground">
                            {event.detail || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                          {event.ip ?? "—"}
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
    </div>
  );
}
