"use client";

// Vue « Plan & décisions » : plan de réalisation par phases, critères d'acceptation
// de la v1, décisions d'architecture figées et point d'attention architectural.

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ————————————————————————————————————————————————————————————
// Phases (partagées avec le tableau de bord)
// ————————————————————————————————————————————————————————————

export interface PlanPhase {
  num: string;
  title: string;
  description: string;
  status: "done" | "active" | "planned" | "prototype";
}

export const PHASES: PlanPhase[] = [
  {
    num: "01",
    title: "Audit du VPS",
    description:
      "Préalable — Vérifier Docker, les ports, les ressources, le pare-feu, Nginx, les domaines et les conflits. Ne rien modifier avant cet audit.",
    status: "done",
  },
  {
    num: "02",
    title: "Connexion RustDesk",
    description:
      "Déployer la signalisation et le relais, configurer un premier téléphone Android 14 et tester une session depuis un autre réseau.",
    status: "active",
  },
  {
    num: "03",
    title: "Backend Python",
    description:
      "Implémenter FastAPI, PostgreSQL, les utilisateurs, le registre des appareils, les sessions administratives et l'audit.",
    status: "planned",
  },
  {
    num: "04",
    title: "Console d'administration",
    description:
      "Construire le tableau de bord responsive, les fiches appareils, les états, les historiques et les actions autorisées.",
    status: "prototype",
  },
  {
    num: "05",
    title: "Validation et durcissement",
    description:
      "Tester les reconnexions, les pertes de réseau, les révocations, les permissions Android, les sauvegardes et la sécurité de bout en bout.",
    status: "planned",
  },
];

const PHASE_STATUS_META = {
  done: { label: "Terminé", className: "border-emerald-500/40 text-emerald-400" },
  active: { label: "En cours", className: "border-amber-500/40 text-amber-400" },
  prototype: { label: "En cours — ce prototype", className: "border-amber-500/40 text-amber-400" },
  planned: { label: "Planifié", className: "text-muted-foreground" },
} as const;

export function PhaseStatusBadge({ status }: { status: PlanPhase["status"] }) {
  const meta = PHASE_STATUS_META[status];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

// ————————————————————————————————————————————————————————————
// Contenu statique
// ————————————————————————————————————————————————————————————

const ACCEPTANCE_CRITERIA = [
  "Le VPS héberge les services sans perturber les applications existantes.",
  "Un téléphone autorisé est accessible depuis un réseau extérieur.",
  "L'écran peut être visualisé et les interactions compatibles fonctionnent.",
  "L'administrateur peut identifier les appareils et gérer les sessions.",
  "Les commandes refusées ou échouées sont correctement journalisées.",
  "La révocation empêche l'accès via la plateforme de gestion.",
  "Les secrets, données et ports d'administration ne sont pas exposés publiquement.",
  "Le système redémarre correctement après un redémarrage du VPS.",
];

const ARCHITECTURE_DECISIONS: { decision: string; choice: string }[] = [
  { decision: "Nom du projet", choice: "Android Remote Control" },
  { decision: "Version initiale", choice: "v1.0" },
  { decision: "Infrastructure", choice: "VPS Ubuntu 24.04 existant" },
  { decision: "Déploiement", choice: "Docker Compose" },
  { decision: "Backend", choice: "Python + FastAPI" },
  { decision: "Interface", choice: "Next.js" },
  { decision: "Base de données", choice: "PostgreSQL" },
  { decision: "Contrôle visuel initial", choice: "RustDesk OSS" },
  { decision: "Réseaux différents", choice: "Signalisation et relais RustDesk" },
  { decision: "Automatisation", choice: "Registre de commandes autorisées" },
  { decision: "Gestion des accès", choice: "Authentification forte, rôles et audit" },
  { decision: "Première cible", choice: "Un Android 14, puis extension multi-appareils" },
];

// ————————————————————————————————————————————————————————————
// Vue
// ————————————————————————————————————————————————————————————

export function PlanView() {
  return (
    <div className="flex flex-col gap-4">
      {/* a — Plan de réalisation par phases */}
      <Card>
        <CardHeader>
          <CardTitle>Plan de réalisation par phases</CardTitle>
          <CardDescription>
            Feuille de route du système Android Remote Control — cinq phases, du VPS au durcissement final.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PHASES.map((phase) => (
            <article
              key={phase.num}
              className="flex flex-col gap-2.5 rounded-lg border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-emerald-400">{phase.num}</span>
                <PhaseStatusBadge status={phase.status} />
              </div>
              <h3 className="text-sm font-medium">{phase.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{phase.description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      {/* b — Critères d'acceptation de la v1 */}
      <Card>
        <CardHeader>
          <CardTitle>Critères d&apos;acceptation de la v1</CardTitle>
          <CardDescription>
            La version 1.0 sera validée lorsque chacun de ces points sera vérifié sur le VPS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5">
            {ACCEPTANCE_CRITERIA.map((criteria) => (
              <li key={criteria} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-emerald-400"
                  aria-hidden
                />
                <span>{criteria}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* c — Décisions d'architecture figées */}
      <Card>
        <CardHeader>
          <CardTitle>Décisions d&apos;architecture figées</CardTitle>
          <CardDescription>
            Ces choix sont verrouillés pour la v1.0 et servent de référence aux phases suivantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Décision</TableHead>
                <TableHead>Choix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ARCHITECTURE_DECISIONS.map((row) => (
                <TableRow key={row.decision}>
                  <TableCell className="font-medium">{row.decision}</TableCell>
                  <TableCell className="text-muted-foreground">{row.choice}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* d — Point d'attention */}
      <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-300">
        <AlertTriangle className="size-4 text-amber-400" aria-hidden />
        <AlertTitle>Point architectural à ne pas négliger</AlertTitle>
        <AlertDescription className="text-amber-200/80">
          RustDesk OSS et le backend (FastAPI) sont deux systèmes distincts. Pour que les boutons du
          tableau de bord ouvrent une session, affichent un flux vidéo intégré ou exécutent des
          gestes, l&apos;intégration correspondante devra être développée et testée. Il ne faut pas
          confondre l&apos;affichage d&apos;un identifiant RustDesk avec une véritable API de contrôle
          de session. Ce prototype matérialise la phase 04 avec un backend de simulation ; le backend
          FastAPI/PostgreSQL du VPS implémentera le même contrat d&apos;API.
        </AlertDescription>
      </Alert>

      <p className="text-center text-xs text-muted-foreground">
        Document de référence — plan, critères et décisions figurent également dans le dossier du projet.
      </p>
    </div>
  );
}
