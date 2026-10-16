# Android Remote Control — Console d'administration

Prototype fonctionnel de la **console d'administration** du système *Android Remote Control* (v1.0) : pilotage à distance d'appareils Android (cible initiale : un Android 14) depuis un VPS, avec contrôle visuel RustDesk, registre de commandes autorisées et journal d'audit complet.

> **Statut** : prototype de la phase 04 (« Console d'administration ») du plan de réalisation en 5 phases. Le backend de simulation matérialise le contrat d'API qui sera implémenté par FastAPI + PostgreSQL sur le VPS.

## Écrans

| Vue | Contenu |
|---|---|
| **Tableau de bord** | KPI temps réel (appareils en ligne, sessions actives, commandes en file, refus/échecs 24 h), état des appareils, activité d'audit récente, avancement des phases |
| **Appareils** | Table + fiche détaillée : enregistrement (ID RustDesk unique), autorisation, révocation avec confirmation, recherche |
| **Sessions** | Ouverture Observation / Contrôle sur appareils autorisés et joignables uniquement, IP source, durée live, clôture, interruption sur perte réseau |
| **Commandes** | Registre des 8 commandes autorisées avec niveaux de risque, émission avec payload dynamique, cycle PENDING → RUNNING → SUCCESS / FAILED / REFUSED |
| **Journal d'audit** | Traçabilité intégrale : connexions, refus, révocations, événements système — filtres par décision et par type de cible |
| **Plan & décisions** | Feuille de route en 5 phases, critères d'acceptation v1, décisions d'architecture figées |

Identifiants de démonstration : **admin / Arc@2024!**

## Décisions d'architecture figées (v1.0)

| Décision | Choix |
|---|---|
| Nom du projet | Android Remote Control |
| Version initiale | v1.0 |
| Infrastructure | VPS Ubuntu 24.04 existant |
| Déploiement | Docker Compose |
| Backend | Python + FastAPI |
| Interface | Next.js (ce dépôt) |
| Base de données | PostgreSQL |
| Contrôle visuel initial | RustDesk OSS |
| Réseaux différents | Signalisation et relais RustDesk |
| Automatisation | Registre de commandes autorisées |
| Gestion des accès | Authentification forte, rôles et audit |
| Première cible | Un Android 14, puis extension multi-appareils |

⚠️ **Point architectural à ne pas négliger** : RustDesk OSS et le backend (FastAPI) sont deux systèmes distincts. Ouvrir une session, afficher un flux vidéo intégré ou exécuter des gestes depuis ce tableau de bord exigera une intégration dédiée. L'affichage d'un identifiant RustDesk **ne vaut pas** une véritable API de contrôle de session.

## Stack du prototype

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + Lucide
- **Prisma** — SQLite en développement, **PostgreSQL en production** (voir ci-dessous)
- API routes Next.js simulant le futur backend FastAPI (même contrat d'interface)
- Simulateur intégré : battements de cœur, pertes réseau, reconnexions, exécution des commandes — tout est journalisé

## Démarrage local

```bash
# 1. Dépendances
bun install

# 2. Base de données (SQLite) — migrations + données de démonstration
cp .env.example .env
bun run db:migrate      # applique prisma/migrations
bun run db:seed         # 1 admin, 4 appareils, historiques

# 3. Lancement
bun run dev             # http://localhost:3000
```

> Sans Bun : `npm install && npx prisma migrate dev && npx tsx prisma/seed.ts && npm run dev`.

### Passer à PostgreSQL (production VPS)

1. Dans `prisma/schema.prisma` : `provider = "postgresql"`.
2. `DATABASE_URL=postgresql://arc:<mot-de-passe>@localhost:5432/android_remote_control`.
3. `bunx prisma migrate deploy && bun run db:seed`.
4. Regénérer le client : `bunx prisma generate`.

## Déploiement VPS (Docker Compose)

Deux fichiers sont fournis :

- **`docker-compose.yml`** — démarrage rapide en local/VPS avec SQLite (volumes persistants) ;
- **`docker-compose.vps.yml`** — cible production conforme aux décisions figées : console Next.js + **PostgreSQL 16** + **RustDesk OSS** (signalisation `hbbs` et relais `hbbr` sur des réseaux Docker distincts, comme l'exige la section « Réseaux différents »).

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Le guide complet (audit préalable du VPS, ports à ouvrir, durcissement) se trouve dans [`docs/DEPLOIEMENT-VPS.md`](docs/DEPLOIEMENT-VPS.md).

### Ports RustDesk à exposer

| Service | Ports | Usage |
|---|---|---|
| `hbbs` (signalisation) | 21115/tcp, 21116/tcp+udp, 21118/tcp | Enregistrement, traversal NAT, websocket |
| `hbbr` (relais) | 21117/tcp, 21119/tcp | Flux d'écran et contrôle via relais |

## Contrat d'API (repris tel quel par le futur backend FastAPI)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login` | Connexion (cookie httpOnly) |
| GET | `/api/auth/me` · POST `/api/auth/logout` | Session courante / déconnexion |
| GET | `/api/stats` | Compteurs temps réel + audit récent |
| GET/POST | `/api/devices` | Liste / enregistrement d'appareils |
| GET/PATCH | `/api/devices/[id]` | Fiche détaillée / autoriser · révoquer · notes |
| GET/POST | `/api/sessions` · PATCH `/api/sessions/[id]` | Sessions administratives / clôture |
| GET/POST | `/api/commands` | Historique / émission (registre obligatoire) |
| GET | `/api/commands/registry` | Registre des commandes autorisées |
| GET | `/api/audit?decision=&targetType=` | Journal d'audit filtrable |
| POST | `/api/simulator/tick` | Pas de simulation (prototype) |

**Règles de refus implémentées** : commande hors registre → 400 ; appareil non autorisé/révoqué → `REFUSED` + audit `DENIED` ; commande nécessitant une session de contrôle active sans session → `REFUSED` + audit ; session sur appareil injoignable → 409.

## Registre des commandes autorisées

| Commande | Risque | Session requise |
|---|---|---|
| `SCREEN_VIEW` (vue d'écran) | Faible | Observation |
| `SCREENSHOT` (capture) | Faible | Observation |
| `APP_LAUNCH` (lancement d'application) | Modéré | Observation |
| `TEXT_INPUT` (saisie de texte) | Modéré | Contrôle |
| `TAP` (appui simulé) | Modéré | Contrôle |
| `SWIPE` (balayage) | Modéré | Contrôle |
| `LOCK` (verrouillage) | Élevé | Contrôle |
| `REBOOT` (redémarrage) | Élevé | Contrôle |

## Plan de réalisation par phases

- **01 — Audit du VPS** : Docker, ports, ressources, pare-feu, Nginx, domaines, conflits. Ne rien modifier avant cet audit.
- **02 — Connexion RustDesk** : signalisation + relais, premier téléphone Android 14, session depuis un autre réseau.
- **03 — Backend Python** : FastAPI, PostgreSQL, utilisateurs, registre des appareils, sessions administratives, audit.
- **04 — Console d'administration** : ce dépôt (tableau de bord, fiches appareils, états, historiques, actions autorisées).
- **05 — Validation et durcissement** : reconnexions, pertes réseau, révocations, permissions Android, sauvegardes, sécurité de bout en bout.

## Sécurité

- Mots de passe hachés (**scrypt**, salt aléatoire) ; cookie de session `httpOnly` + `sameSite=lax`.
- Toute action sensible est **journalisée dans l'audit** — y compris les refus et les échecs.
- `.env` jamais commité ; identifiants de démonstration à changer avant tout déploiement réel (voir `docs/DEPLOIEMENT-VPS.md`, section durcissement).
