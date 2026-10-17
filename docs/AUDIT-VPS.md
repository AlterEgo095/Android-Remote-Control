# Audit du VPS (lecture seule) — Android Remote Control v1.0

> **Statut : EXÉCUTÉ le 2026-10-17 à 20:14 UTC** via `deploy/vps-audit.sh` (100 % lecture seule — rien installé, rien modifié, rien redémarré). Rapport brut : `audit-vps-brut.txt` (1511 lignes, archivé hors git pour éviter toute donnée d'infrastructure dans le dépôt public — les extraits ci-dessous sont assainis).
>
> **Verdict : GO — avec 3 ajustements intégrés aux configs** (port console 3260, webroot certbot, subnet Docker dédié). Aucun blocage. Aucun impact sur les applications existantes.

## 1. Identité du serveur

| Élément | Valeur |
|---|---|
| Hôte | `vmi3058261` — 95.111.226.63 (IPv4 seule côté origine) |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0-142-generic |
| CPU / RAM | 6 vCPU — 12 Go RAM (7,5 utilisés, **~4,4 Go disponibles**), swap 8 Go |
| Disque | 193 Go, **51 Go libres** (74 % utilisés) |
| Charge | ~2,4 / 6 cœurs au moment de l'audit — confortable |
| Uptime | 3 jours (redémarrage récent, tous les services revenus) |
| Accès | SSH 22, utilisateur `aenews` (groupes : `sudo`, `docker`, `ollama`) |

**Capacité pour ARC** : console Next.js (~300–500 Mo RAM) + PostgreSQL (~200–400 Mo) ≈ **< 1 Go** → marge large. Images à construire ~500 Mo de disque → sans impact.

## 2. Comment les applications existantes sont déployées (le modèle à suivre)

Le serveur héberge **~80 conteneurs** et **~10 apps PM2**, tous derrière **un Nginx hôte unique** (systemd, 1.24.0) écoutant sur 80/443 :

1. **Deux conventions de runtime coexistent** :
   - **Docker Compose par projet** dans `/opt/<PROJET>` (KINSHOP, IAHUB, SITE-AENEWS, market, wedding, penpot, neurolearn, aeip-x-os, AENEWSBUILDER…), chaque stack a **son réseau bridge dédié** et n'expose que des ports **127.0.0.1** (ex. `127.0.0.1:3001`, `:3080`, `:4000`, `:5433`, `:15432`).
   - **PM2** pour des apps Node/Next.js directes (`aenewsos-frontend`, `iahub`, `ged-isipa`, `hpp-qr` sur 3006…) — dont **une app PM2 occupe déjà `0.0.0.0:3000`**.
2. **Nginx** : un fichier par site dans `/etc/nginx/sites-available/` + symlink `sites-enabled/` (~40 sites actifs). Pattern type (`qr.hpph.net`, le plus récent) : `listen 443 ssl http2`, certificat **Let's Encrypt par domaine**, `proxy_pass http://127.0.0.1:<port>`, headers `Upgrade/Connection` (WebSocket), `limit_req_zone` anti-spam, HSTS + en-têtes de sécurité, logs dédiés.
3. **Certificats** : `certbot 2.9.0` sur l'hôte, **30 domaines** déjà émis, mode **`authenticator = webroot`**, `webroot_path = /var/www/certbot` (répertoire existant, propriété `aenews`), clés **ECDSA**. Le challenge HTTP-01 passe **à travers le proxy Cloudflare** — prouvé par les 30 émissions existantes.
4. **`conf.d` global** (hérité par tous les sites) : `02-cloudflare-realip.conf` (restauration de l'IP réelle visiteur — indispensable, nos rate-limits nginx s'appliqueront à la vraie IP), `00-security-hardening.conf`, `00-performance.conf`, `01-block-ai-crawlers.conf`.
5. **Pare-feu** : UFW actif, défaut `deny incoming`. 80/443 ouverts aux plages Cloudflare **et** à `Anywhere` (double règle préexistante). Les ports applicatifs internes (3000, 3070, 8888…) sont explicitement **DENY** en direct.
6. **Mailcow** en production (SMTP/IMAP : 25, 465, 587, 143, 993…) — **zone à ne pas toucher**, aucun chevauchement avec ARC.

## 3. DNS & TLS — android.aenews.online

| Vérification | Résultat |
|---|---|
| Résolution | `104.21.74.215`, `172.67.163.104` + IPv6 `2606:4700:…` → **IPs Cloudflare** |
| Statut | **Proxifié (nuage orange) confirmé** — l'origine n'est pas exposée directement |
| Certificat edge | Cloudflare Universal SSL `CN = aenews.online` (couvre `*.aenews.online`), valable jusqu'au **9 déc. 2026**, Let's Encrypt |
| Certificat origine | **Absent** (aucun site nginx `android.aenews.online`) → à émettre via certbot (pattern éprouvé du serveur) |
| Conflit `server_name` | **AUCUN** — aucun site existant ne déclarait ce domaine |

> Conséquence : le chiffrement visiteur ↔ Cloudflare est déjà opérationnel. Il reste le maillon **Cloudflare ↔ origine** : certificat Let's Encrypt origine via `certbot certonly --webroot -w /var/www/certbot` (recommandé plutôt que `--nginx` pour ne pas laisser certbot retoucher d'autres vhosts).

## 4. Ports — conflits et disponibilité

| Port | État au 2026-10-17 | Impact ARC | Décision |
|---|---|---|---|
| 80 / 443 | Nginx hôte (systemd) | Aucun — on ajoute un vhost | Réutiliser l'infra existante |
| **3000** | **OCCUPÉ** — `next-server` PM2 sur `0.0.0.0:3000` | **Conflit direct** avec la config préparée (`127.0.0.1:3000`) | **Console déplacée sur `127.0.0.1:3260`** (libre, vérifié) — compose + nginx corrigés |
| 5432 | Occupé (127.0.0.1, `market-postgres`) | Aucun — PostgreSQL ARC **jamais publié** | Conforme à notre compose |
| 5433–5440, 15432, 27018, 6380… | Occupés (autres stacks) | Aucun | — |
| **21115–21119** | **LIBRES** | RustDesk (phase ultérieure) | GO pour la phase 5 (règles UFW à ajouter alors) |
| 3260 | LIBRE | Console ARC | ✅ choisi |
| Subnets Docker | 172.17 → 172.31 pris | Création réseau compose | **`172.32.0.0/16` épinglé** dans le compose |

## 5. Docker / versions

| Élément | Valeur | Compatibilité |
|---|---|---|
| Docker | 29.4.3 | ✅ moderne |
| Compose | v5.1.3 | ✅ supporte `name:`, `condition: service_healthy`, `:?required` |
| Images / volumes | 92 images (33,7 Go, 13,7 Go récupérables), 59 volumes | Aucune action (lecture seule) |
| Conteneurs `arc-*` | **AUCUN** | ✅ pas de collision de noms |

## 6. Anomalies préexistantes (SANS rapport avec ARC — signalées, non corrigées)

| Anomalie | Détail | Action |
|---|---|---|
| `market-nginx` et `wedding-nginx` en boucle de crash (`Restarting`) | Échouent depuis avant l'audit | **Ne pas toucher** — hors périmètre ; à signaler au propriétaire |
| Services `market-*` en état `Created` (jamais démarrés) : frontend, scraper, admin, odds-engine, certbot | Stack incomplète | Idem |
| `siteaenews-docker-proxy-ai` unhealthy | Docker socket proxy | Idem |
| UFW : 80/443 ouverts à `Anywhere` en plus des plages Cloudflare | L'origine reste joignable en contournant CF (si DNS gris) | Recommandation future (hors périmètre ARC) : restreindre aux seules plages CF — **attention** : peut impacter d'autres apps, décision propriétaire |
| Auth SSH par mot de passe activée | Utilisée pour cet audit | Recommandation : basculer sur clés + `PasswordAuthentication no` (décision propriétaire) |

## 7. Critères GO / NO-GO — résultats

1. ✅ Compose v2 présent (v5.1.3).
2. ✅ Port local pour la console : **3260 libre** (3000 occupé → ajustement appliqué). 21115–21119 libres.
3. ✅ ≥ 1 Go RAM libre (4,4 Go) et ≥ 2 Go disque (51 Go).
4. ✅ DNS `android.aenews.online` résout (Cloudflare proxifié, orange) — certificat origine à émettre (prévu étape 6 du plan).
5. ✅ Aucun conflit `server_name`, aucun conteneur `arc-*`.

**Verdict : GO.** Les 3 ajustements (port 3260, webroot `/var/www/certbot`, subnet `172.32.0.0/16`) ont été appliqués aux fichiers du dépôt (`docker-compose.vps.yml`, `deploy/nginx/android.aenews.online.conf`) avant toute opération serveur.

## 8. Règles de non-régression (issues de l'audit, intégrées au plan)

- **Ne toucher que des fichiers nouveaux** : `/etc/nginx/sites-available/android.aenews.online.conf`, `/etc/nginx/snippets/arc-proxy.conf` — aucun site existant modifié ; rollback = suppression du symlink + `nginx -t && reload`.
- **Zéro interaction avec Mailcow** (aucun port partagé, aucun réseau partagé).
- **Zéro publication de port** hors `127.0.0.1:3260` (console) — PostgreSQL strictement interne.
- **Phase RustDesk séparée** : les règles UFW 21115–21119 ne sont ajoutées qu'à l'étape dédiée, réversibles.
- Vérification après chaque étape : `nginx -t` vert + tous les sites existants toujours en 200 (`curl -sI` sur 2–3 domaines témoins).
