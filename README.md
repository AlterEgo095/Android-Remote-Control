# Android Remote Control — Console d'administration

Prototype fonctionnel de la **console d'administration** du système *Android Remote Control* (v1.0) : pilotage à distance d'appareils Android (cible initiale : un Android 14) depuis un VPS, avec contrôle visuel RustDesk, registre de commandes autorisées et journal d'audit complet.

> **Statut** : prototype de la phase 04 (« Console d'administration ») du plan de réalisation en 5 phases — **audit complet effectué, durci et préparé pour la production** sur `https://android.aenews.online` (voir `docs/RAPPORT-AUDIT-CODE.md` et `docs/PLAN-DEPLOIEMENT.md`). Le backend de simulation matérialise le contrat d'API qui sera repris par FastAPI + PostgreSQL sur le VPS. Le simulateur est **strictement séparé** du mode production (voir « Modes d'exécution »).

## Écrans

| Vue | Contenu |
|---|---|
| **Tableau de bord** | KPI temps réel (appareils en ligne, sessions actives, commandes en file, refus/échecs 24 h), état des appareils, activité d'audit récente, avancement des phases |
| **Appareils** | Table + fiche détaillée : enregistrement (ID RustDesk unique), autorisation, révocation avec confirmation, recherche |
| **Sessions** | Ouverture Observation / Contrôle sur appareils autorisés et joignables uniquement, IP source, durée live, clôture, interruption sur perte réseau |
| **Commandes** | Registre des 8 commandes autorisées avec niveaux de risque, émission avec payload dynamique, cycle PENDING → RUNNING → SUCCESS / FAILED / REFUSED |
| **Journal d'audit** | Traçabilité intégrale : connexions, refus, révocations, événements système — filtres par décision et par type de cible |
| **Plan & décisions** | Feuille de route en 5 phases, critères d'acceptation v1, décisions d'architecture figées |

Identifiants de démonstration : **admin / Arc@2024!** — affichés à l'écran **uniquement en mode simulation** ; jamais en production (création de l'administrateur par `prisma/bootstrap-admin.ts`).

## Modes d'exécution (`ARC_MODE`)

| | `simulation` (défaut, prototype) | `production` |
|---|---|---|
| Simulateur (heartbeats, pertes réseau, résultats) | actif | **désactivé (503)** — le frontend ne l'appelle plus |
| Ouverture de session / émission de commande | cycle simulé | **503 « intégration terminal indisponible »** — journalisé dans l'audit, aucune donnée fabriquée |
| Autorisation d'appareil | passe « En ligne » | reste « En attente de première connexion réelle » |
| Administrateur | seed de démonstration | `bun prisma/bootstrap-admin.ts` (one-shot) |
| Interface | badge ambre « Simulation » | badge + bandeau « intégration terminal à connecter », encart démo masqué |

Le mode courant est consultable publiquement via `GET /api/system/config`.

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

Le schéma PostgreSQL dédié vit dans `prisma/postgres/` avec sa **migration de base contrôlée**. Le build Docker sélectionne le provider sans aucune édition manuelle :

```bash
docker build --build-arg ARC_SCHEMA=postgres -t arc-console .   # utilisé par docker-compose.vps.yml
docker compose -f docker-compose.vps.yml run --rm console \
  bunx --bun prisma migrate deploy --schema prisma/postgres/schema.prisma
```

En local (hors Docker) : `DATABASE_URL=postgresql://… bun run db:migrate-deploy-pg`. Le **seed de démonstration refuse de s'exécuter** en mode production — utiliser `bun run db:bootstrap-admin`.

## Déploiement VPS (Docker Compose) — android.aenews.online

Deux fichiers sont fournis :

- **`docker-compose.yml`** — démarrage rapide en local/simulation avec SQLite (volumes persistants) ;
- **`docker-compose.vps.yml`** — cible production (projet Compose `android-remote-control`, versions épinglées, healthchecks, logs bornés, secrets obligatoires) : console Next.js bindée **127.0.0.1:3000** + **PostgreSQL 16.4** (jamais publié) + **RustDesk OSS 1.1.12** (signalisation `hbbs` et relais `hbbr` sur des réseaux Docker distincts).

```bash
cp deploy/env.vps.example .env    # remplir ARC_SESSION_SECRET + POSTGRES_PASSWORD
docker compose -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml run --rm console bun prisma/bootstrap-admin.ts
```

Le plan pas-à-pas (audit VPS, Nginx/TLS `android.aenews.online`, RustDesk, validation, retours arrière) se trouve dans [`docs/PLAN-DEPLOIEMENT.md`](docs/PLAN-DEPLOIEMENT.md) ; les configurations Nginx prêtes à installer sont dans [`deploy/nginx/`](deploy/nginx/).

### Ports RustDesk à exposer

| Service | Ports | Usage |
|---|---|---|
| `hbbs` (signalisation) | 21115/tcp, 21116/tcp+udp, 21118/tcp | Enregistrement, traversal NAT, websocket |
| `hbbr` (relais) | 21117/tcp, 21119/tcp | Flux d'écran et contrôle via relais |

## Contrat d'API (repris tel quel par le futur backend FastAPI)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | Contrôle de disponibilité minimal (service + base), sans exposition d'information |
| POST | `/api/auth/login` | Connexion (cookie httpOnly + HMAC ; anti-bruteforce 429) |
| GET | `/api/auth/me` · POST `/api/auth/logout` | Session courante / déconnexion |
| GET | `/api/system/config` | Mode d'exécution public (`simulation` \| `production`) |
| GET | `/api/stats` | Compteurs temps réel + audit récent |
| GET/POST | `/api/devices` | Liste / enregistrement d'appareils (zod) |
| GET/PATCH | `/api/devices/[id]` | Fiche détaillée / autoriser · révoquer · notes |
| GET/POST | `/api/sessions` · PATCH `/api/sessions/[id]` | Sessions administratives / clôture |
| GET/POST | `/api/commands` | Historique / émission (registre obligatoire, payload zod strict) |
| GET | `/api/commands/registry` | Registre des commandes autorisées |
| GET | `/api/audit?decision=&targetType=` | Journal d'audit filtrable (valeurs contraintes) |
| POST | `/api/simulator/tick` | Pas de simulation (prototype uniquement — 503 en production) |

**Règles de refus implémentées** : commande hors registre → 400 ; payload invalide → 400 + audit ; appareil non autorisé/révoqué → `REFUSED` + audit `DENIED` ; commande nécessitant une session de contrôle active sans session → `REFUSED` + audit ; session sur appareil injoignable → 409 ; `Origin` étrangère sur requête mutante → 403 (CSRF) ; trop de tentatives de connexion → 429.

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

- Mots de passe hachés (**scrypt**, salt aléatoire, `timingSafeEqual`).
- Cookie de session **signé HMAC-SHA256** (`ARC_SESSION_SECRET` obligatoire en production), `httpOnly` + `sameSite=lax` + **`Secure`** en production, expiration vérifiée côté serveur.
- **Anti-bruteforce** : 5 échecs/15 min par IP+identifiant (429 + `Retry-After`), garde par IP, blocages journalisés.
- **Anti-CSRF** : toute requête mutante `/api/*` avec `Origin` étrangère est rejetée (403) — `src/proxy.ts` (Next 16).
- **Validation zod** serveur sur les entrées (appareils, sessions, commandes/payloads, filtres d'audit).
- En-têtes de sécurité (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) posés par l'app **et** Nginx ; HSTS en production.
- Toute action sensible est **journalisée dans l'audit** — y compris les refus, échecs et blocages ; aucun secret n'est journalisé.
- `.env` jamais commité (`deploy/env.vps.example` documenté) ; **aucun identifiant de démonstration en production** (seed refusé, bootstrap one-shot).
- Tests de fumée ré-exécutables après déploiement : `bun run smoke-test` (ou `bash deploy/smoke-test.sh`).
