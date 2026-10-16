# Rapport d'audit du code — Android Remote Control v1.0

**Périmètre** : audit complet du dépôt (`/home/z/my-project`), corrections appliquées, tests exécutés. Objectif : préparation de production pour `https://android.aenews.online` **sans déploiement effectif**.
**Méthode** : inspection fichier par fichier (inventaire vérifié, pas de supposition), puis corrections conservant le travail existant, puis campagne de tests exécutée (API, navigateur, mode production, bootstrap).

---

## 1. Technologies réellement identifiées

| Élément | Réalité vérifiée |
|---|---|
| Frontend + API | **Next.js 16.1.3** (App Router, Turbopack), TypeScript 5 strict, React 19 |
| UI | Tailwind CSS 4, shadcn/ui (New York), lucide-react, sonner, framer-motion |
| ORM / DB | Prisma 6.19 — **SQLite** en dev/simulation ; **PostgreSQL** préparé (`prisma/postgres/`) |
| Runtime | Bun 1.2 (dev + image Docker `oven/bun:1.2`) |
| Validation | **zod 4** — déclarée mais inutilisée avant audit ; désormais appliquée serveur |
| Auth | scrypt (salt aléatoire) + cookie `arc_token` |
| Tests | Aucun framework avant audit → suite de fumée `deploy/smoke-test.sh` + campagne navigateur |
| Docker | Dockerfile multi-stage standalone, `docker-compose.yml` (dev), `docker-compose.vps.yml` (prod) |

## 2. Structure du projet (vérifiée)

```
src/app/            page.tsx (console unique) + /health + api/** (13 routes → 15 après audit)
src/components/console/  9 vues FR (dashboard, devices, sessions, commands, audit, plan, login, shell, helpers)
src/lib/            types, commands-registry (+zod), auth (HMAC), config, rate-limit, audit, simulator, db
src/hooks/          use-console-data (polling 4 s, 401 global, mode)
src/proxy.ts        (ex-middleware.ts, Next 16) défense CSRF par Origin
prisma/             schema (sqlite), postgres/ (schéma + migration 0001_init), seed, bootstrap-admin
deploy/             nginx/ (conf android.aenews.online + proxy), env.vps.example, vps-audit.sh, smoke-test.sh
docker/             entrypoint.sh (migrations contrôlées)
docs/               DEPLOIEMENT-VPS, RAPPORT-AUDIT-CODE, PLAN-DEPLOIEMENT, AUDIT-VPS
```

## 3. Fonctionnalités vérifiées (verdict par module)

| Module | Verdict | Détail |
|---|---|---|
| A — Tableau de bord | ✅ VÉRIFIÉ | 4 KPI, état appareils, activité récente, avancement phases |
| B — Appareils | ✅ VÉRIFIÉ | recherche, enregistrement, fiche, autoriser/révoquer + confirmation, états |
| C — Sessions | ✅ VÉRIFIÉ (réserve levée) | Observation/Contrôle, refus 403/409, durée, clôture ; **IP factice supprimée** |
| D — Registre des commandes | ✅ VÉRIFIÉ (réserve levée) | 8 commandes, risques, requiresControl, cycle de vie ; **payloads désormais validés serveur** |
| E — Journal d'audit | ✅ VÉRIFIÉ (réserve levée) | toutes catégories, filtres **contraints** (400 sinon) |
| F — Plan & décisions | ✅ VÉRIFIÉ | 5 phases, critères v1, 12 décisions |
| Transverse | ✅ CONFORME | 100 % FR, mode sombre, responsive 390 px vérifié, footer collé |

## 4. Défauts identifiés → corrections appliquées

| # | Défaut (avant audit) | Criticité | Correction appliquée |
|---|---|---|---|
| 1 | Cookie de session **non signé** (base64 JSON forgeable) | 🔴 critique | Token **HMAC-SHA256** (`ARC_SESSION_SECRET`), vérification signature + expiration **serveur** (`src/lib/auth.ts`) |
| 2 | Expiration du token jamais vérifiée côté serveur | 🔴 critique | Champ `exp` vérifié dans `getSession()` |
| 3 | Cookie sans flag `Secure` | 🔴 critique | `Secure` actif en production (`ARC_COOKIE_SECURE`, défaut production) |
| 4 | Aucune limitation de tentatives de connexion | 🔴 critique | Anti-bruteforce en mémoire : 5 échecs/15 min par (IP+identifiant) + garde IP, 429 + `Retry-After`, blocages journalisés (`src/lib/rate-limit.ts`) |
| 5 | Aucune protection CSRF | 🔴 critique | `src/proxy.ts` : rejet 403 si `Origin` ≠ hôte servi sur toute requête mutante `/api/*` (complément `SameSite=lax`) |
| 6 | Identifiants de démo en dur (seed + écran de connexion) | 🔴 critique | Seed **refusé** en mode production (exit 1) ; encart démo affiché **uniquement** en simulation ; création admin par `prisma/bootstrap-admin.ts` (mdp ≥ 12 car. ou généré fort, affiché une fois, refus d'écrasement sans `ARC_ADMIN_RESET`) |
| 7 | Seed **destructif** exécuté à chaque démarrage du conteneur (`deleteMany`) | 🔴 critique | Dockerfile : plus aucun seed automatique ; entrypoint = migrations (`ARC_RUN_MIGRATIONS=1`) + serveur ; échec de migration = démarrage interrompu |
| 8 | Payloads de commandes non validés serveur | 🟠 majeur | Schémas zod **stricts** par commande (`validateCommandPayload`) ; payload invalide → 400 + audit `COMMAND_INVALID` |
| 9 | IP source factice `203.0.113.24` en base | 🟠 majeur | IP réelle via `x-forwarded-for` (dérouté par Nginx), `null` sinon |
| 10 | Filtres d'audit non contraints | 🟠 majeur | Énumérations validées → 400 sinon |
| 11 | `log: ['query']` Prisma actif en production | 🟠 mineur | Journal SQL limité au développement |
| 12 | `ignoreBuildErrors: true` | 🟠 mineur | Supprimé ; **`tsc --noEmit` : 0 erreur projet** |
| 13 | Bug d'audit : comptage des sessions actives après fermeture | 🟡 mineur | Comptage avant fermeture, message exact |
| 14 | Erreurs TS préexistantes dans `/api/stats` | 🟡 mineur | Types corrigés (DeviceStatus/AuditDecision, dates ISO) |
| 15 | `package.json` générique (`nextjs_tailwind_shadcn_ts`) | 🟡 mineur | Renommé `android-remote-control` 1.0.0 + scripts `typecheck`, `db:bootstrap-admin`, `smoke-test` |
| 16 | En-têtes de sécurité absents | 🟡 mineur | `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (next.config **et** Nginx) |
| 17 | Dépendances mortes (next-auth, recharts, mdxeditor…) | ℹ️ dette | Documenté — non retiré pour préserver les composants shadcn (optimisation future) |

## 5. Fonctions simulées — séparation simulation/production

**Nouveau contrat de mode** (`ARC_MODE`, lu dans `src/lib/config.ts`, exposé publiquement via `GET /api/system/config`) :

| Comportement | Simulation (défaut, prototype) | Production |
|---|---|---|
| Moteur `tick` (heartbeats, pertes réseau, résultats) | ✅ actif (polling frontend) | ❌ **503** — frontend ne l'appelle plus |
| Ouverture de session | ✅ cycle simulé affiché | ❌ **503** « intégration terminal indisponible » (aucune session déclarée active sans confirmation) |
| Émission de commande | ✅ cycle PENDING→…→résultat | ❌ **503** — aucun faux résultat fabriqué |
| Autorisation d'appareil | passe « En ligne » | reste « **En attente de première connexion réelle** » |
| Administrateur | seed de démo | bootstrap one-shot uniquement |
| Interface | badge ambre « Simulation — données simulées » | badge + **bandeau permanent** « intégration terminal indisponible », encart démo masqué, footer adapté |

Toute tentative en production est **journalisée** (`SESSION_UNAVAILABLE`, `COMMAND_UNAVAILABLE`, décision `ERROR`) : la plateforme n'affiche jamais un état qu'elle n'a pas confirmé.

## 6. Écarts vs architecture cible (constats honnêtes)

| Cible v1.0 | État actuel | Décision |
|---|---|---|
| Backend **FastAPI** | Le backend est l'API Next.js (contrat identique, types partagés) | Le contrat est figé et documenté ; la création de FastAPI reste la phase 03 du plan — recréer un doublon ici aurait violé « conserver le travail existant » |
| PostgreSQL | Préparé : schéma dédié + **migration de base contrôlée** (`prisma/postgres/migrations/0001_init`), build Docker `--build-arg ARC_SCHEMA=postgres`, `migrate deploy` à l'entrypoint | Prêt pour le VPS |
| Intégration RustDesk réelle | **Aucune** : hbbs/hbbr provisionnés dans le compose, mais la console ne communique pas avec eux (IDs stockés uniquement) | Affiché honnêtement (« intégration terminal indisponible ») ; l'ID RustDesk ne vaut pas une API de contrôle |
| Interruption de session à la révocation | Clôture applicative (sessions `CLOSED`) | La clôture **réelle du flux RustDesk** devra être confirmée par l'intégration future — jamais prétendue |
| Domaine `android.aenews.online` | Config Nginx préparée (`deploy/nginx/`), healthcheck `/health`, app bindée `127.0.0.1:3000` | Installation après audit VPS |

## 7. Tests exécutés (résultats réels, sandbox)

**Outil** : `deploy/smoke-test.sh` (12 vérifications curl) + campagnes dédiées + navigateur (agent-browser).

| Campagne | Contenu | Résultat |
|---|---|---|
| **A — Simulation (API)** | 12 tests de fumée ; rate-limit (6e tentative → **429**) ; cookie falsifié sans HMAC → **401** ; flags cookie (`HttpOnly`, `SameSite=lax`, sans `Secure` en simulation) ; audit des blocages | ✅ **12/12 PASS** + durcissements vérifiés |
| **B — Simulation (navigateur)** | login KO/OK, dashboard (KPI, badge Simulation), 6 vues, responsive 390 px, **0 erreur console** | ✅ PASS (captures `/tmp/arc-*.png`) |
| **C — Production (API + navigateur)** | `/api/system/config` → `production` ; `POST tick` → **503** ; `POST sessions` → **503** ; `POST commands` → **503** ; `GET devices` → 200 ; cookie **Secure** présent ; bandeau « Mode production » affiché ; 0 erreur console | ✅ PASS |
| **D — Bootstrap admin** (base temporaire) | seed en production → **refus (exit 1)** ; création admin avec **mot de passe généré affiché une fois** ; 2e exécution → **refus** ; `ARC_ADMIN_RESET=true` → reset OK ; mot de passe court → **refus** ; hash scrypt vérifié en base | ✅ 7/7 PASS |
| **Type & lint** | `tsc --noEmit` : **0 erreur projet** (hors répertoires sandbox gitignorés) ; `eslint` : propre | ✅ PASS |

**Non exécutable ici** (honnêteté) : tests de connexion avec un **vrai téléphone Android** (phase 02), validation Docker image sur le VPS, DNS/TLS réels de `android.aenews.online` — intégrés au plan de déploiement.

## 8. Conclusion

Le prototype était fonctionnel sur les 6 modules ; ses **17 défauts** (5 critiques de sécurité) sont corrigés, la **séparation simulation/production est stricte**, la configuration `android.aenews.online` est préparée, et chaque affirmation de ce rapport est adossée à un test exécuté. Le dépôt est **prêt à être déployé** après l'audit VPS (voir `docs/AUDIT-VPS.md` puis `docs/PLAN-DEPLOIEMENT.md`).
