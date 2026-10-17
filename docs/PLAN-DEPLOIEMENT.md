# Plan de déploiement — android.aenews.online (v1.0)

**Principe** : zéro action sur le VPS tant que l'utilisateur ne valide pas explicitement chaque étape. Chaque étape a son contrôle ; chaque étape a son retour arrière.

> **Audit VPS exécuté le 2026-10-17 — verdict GO** (voir `docs/AUDIT-VPS.md`). Ce plan intègre les 3 ajustements issus de l'audit : port console **3260**, webroot certbot **/var/www/certbot**, subnet Docker **172.32.0.0/16**.

## 0. Prérequis — ÉTAT RÉEL (audit 2026-10-17)

| # | Action | État |
|---|---|---|
| 0.1 | Pousser ce dépôt sur GitHub | ✅ v1.0 + audit poussés (voir historique) |
| 0.2 | DNS `android.aenews.online` | ✅ **Déjà en place** — proxifié Cloudflare (orange), IPs CF vérifiées, certificat edge Universal SSL valable jusqu'au 09/12/2026 |
| 0.3 | Audit VPS lecture seule | ✅ **GO** — certificat origine à émettre (étape 6), rien d'autre |

**Contexte serveur à garder en tête** (issues de l'audit) : ~80 conteneurs (dont **Mailcow en production — zone interdite**), Nginx hôte 1.24 avec ~40 sites, PM2 occupe `0.0.0.0:3000`, `market-nginx`/`wedding-nginx` crash-loopent déjà (ne pas toucher). Vérification non-régression après chaque étape : `nginx -t` vert + app PM2 `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/` toujours en 200 + nombre de conteneurs inchangé. NB (2026-10-17) : les domaines aenews.* ne résolvent plus depuis le VPS (DNS morts) — ne pas les utiliser comme témoins externes.

## 1. Sur le VPS — préparation (sans impact sur les autres apps)

```bash
sudo mkdir -p /opt/android-remote-control && sudo chown $USER /opt/android-remote-control
cd /opt/android-remote-control
git clone https://github.com/AlterEgo095/Android-Remote-Control.git .
```
**Contrôle** : `ls Dockerfile docker-compose.vps.yml deploy/nginx/` présent.
**Retour arrière** : `rm -rf /opt/android-remote-control` (aucun service touché).

## 2. Secrets (jamais committés)

```bash
cp deploy/env.vps.example .env
chmod 600 .env
# REMPLIR : ARC_SESSION_SECRET=$(openssl rand -base64 48)
#          POSTGRES_PASSWORD=$(openssl rand -base64 24)
#          ARC_ADMIN_USERNAME= (choisi) — ARC_ADMIN_PASSWORD= laissé VIDE (généré)
```
**Contrôle** : `grep -c '=$' .env` ne doit plus contenir de valeur vide pour les 2 secrets obligatoires.
**Retour arrière** : `rm .env`.

## 3. Build + démarrage (console + PostgreSQL)

```bash
docker compose -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml ps          # console: healthy, db: healthy
curl -s http://127.0.0.1:3260/health                 # {"status":"ok"}
docker compose -f docker-compose.vps.yml logs console | grep -i "migrations à jour"
```
**Contrôles** : `ss -tlnp | grep 3260` → écoute **127.0.0.1** uniquement ; `ss -tlnp | grep 5432` → rien de nouveau (DB non publiée) ; le port 3000 de l'app PM2 existante **non affecté** (`pm2 ls` inchangé).
**Retour arrière** : `docker compose -f docker-compose.vps.yml down` (les volumes persistent ; `down -v` supprime les données — uniquement avant mise en service).
**Note réseau** : le compose épingle `172.32.0.0/16` (les 172.17–172.31 sont pris par les autres stacks — audit).

## 4. Bootstrap du premier administrateur (one-shot)

```bash
docker compose -f docker-compose.vps.yml run --rm console bun prisma/bootstrap-admin.ts
# → mot de passe généré affiché UNE fois : le noter dans un gestionnaire de secrets
# Retirer ARC_ADMIN_USERNAME de .env si présent, puis :
docker compose -f docker-compose.vps.yml up -d console
```
**Contrôle** : login refusé avec un mot de passe faux (401), accepté avec le mot de passe noté.
**Retour arrière** : `docker compose ... run --rm console bun prisma/bootstrap-admin.ts` avec `ARC_ADMIN_RESET=true` (rotation).

## 5. RustDesk (signalisation + relais)

```bash
sudo ufw allow 21115/tcp && sudo ufw allow 21116/tcp && sudo ufw allow 21116/udp \
  && sudo ufw allow 21117/tcp && sudo ufw allow 21118/tcp && sudo ufw allow 21119/tcp
docker compose -f docker-compose.vps.yml up -d rustdesk-signalisation rustdesk-relais
docker compose -f docker-compose.vps.yml logs rustdesk-signalisation | head   # clés générées
```
Sauvegarder immédiatement le volume `arc-rustdesk-hbbs` (contient les **clés serveur** = stabilité des IDs) :
```bash
docker run --rm -v android-remote-control_arc-rustdesk-hbbs:/data -v $PWD:/out alpine \
  tar czf /out/arc-hbbs-keys-$(date +%F).tgz -C /data .
```
**Contrôle** : client RustDesk sur le téléphone Android 14 → serveur ID = `android.aenews.online` (ou IP) → ID attribué visible.
**Retour arrière** : `docker compose ... rm -sf rustdesk-signalisation rustdesk-relais` + retirer les règles ufw.

## 6. Nginx + TLS (réutilisation de l'infra existante — pattern du serveur)

L'audit confirme : certbot 2.9.0 en webroot `/var/www/certbot` (30 domaines déjà émis ainsi, clés ECDSA), Cloudflare proxifié. Deux options pour le certificat **origine** :

### Option A — Let's Encrypt via certbot webroot (pattern du serveur, à tenter en premier)

```bash
sudo cp deploy/nginx/arc-proxy.conf /etc/nginx/snippets/
sudo cp deploy/nginx/android.aenews.online.bootstrap.conf /etc/nginx/sites-available/android.aenews.online.conf
sudo ln -s /etc/nginx/sites-available/android.aenews.online.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx          # vhost 80 seul (ACME + 503) — les autres sites intacts
sudo certbot certonly --webroot -w /var/www/certbot -d android.aenews.online --key-type ecdsa
# Si le challenge échoue (mode SSL Cloudflare « Full » sans certificat origine) → Option B
sudo cp deploy/nginx/android.aenews.online.conf /etc/nginx/sites-available/android.aenews.online.conf  # vhost complet 80+443
sudo nginx -t && sudo systemctl reload nginx
```

### Option B — Cloudflare Origin CA (repli robuste, standard CF)

Si l'HTTP-01 ne passe pas à travers le proxy : dans Cloudflare → SSL/TLS → **Origin Server** → Create Certificate (`android.aenews.online`, 15 ans), coller cert+clé dans :
```bash
sudo install -m 644 origin-cert.pem /etc/ssl/arc/android.aenews.online.crt
sudo install -m 600 origin-key.pem  /etc/ssl/arc/android.aenews.online.key
# puis remplacer dans le vhost les 2 lignes ssl_certificate* :
#   ssl_certificate     /etc/ssl/arc/android.aenews.online.crt;
#   ssl_certificate_key /etc/ssl/arc/android.aenews.online.key;
sudo nginx -t && sudo systemctl reload nginx
```
(Le mode SSL Cloudflare doit alors être **Full (strict)** — vérifier dans le dashboard.)

**Contrôles (communs)** : `curl -sI https://android.aenews.online/health` → 200 ; `curl -sI http://android.aenews.online/` → 301 HTTPS ; `nginx -t` vert ; app PM2 (127.0.0.1:3000) toujours en 200 ; conteneurs inchangés.
**Retour arrière** : retirer le symlink + `nginx -t && systemctl reload nginx` (aucun autre site touché).

## 7. Validation finale (critères d'acceptation)

```bash
BASE_URL=https://android.aenews.online bash deploy/smoke-test.sh   # 12/12 attendus (hors login si identifiants différents)
```
- [ ] `/health` 200 et exposition minimale.
- [ ] Login admin (bootstrap) OK ; 6 échecs → 429 (anti-bruteforce).
- [ ] Badge « Production — intégration terminal à connecter » + bandeau visible ; **aucune** session/commande fabricable (503 journalisés dans l'audit).
- [ ] Enregistrement + autorisation d'un appareil → « En attente de première connexion réelle ».
- [ ] Session RustDesk réelle depuis réseau 4G (phase 02) — après intégration terminal uniquement.
- [ ] Révocation → sessions fermées, audit `DEVICE_REVOKED`.
- [ ] `sudo reboot` → tous les conteneurs `Up (healthy)` ; session RustDesk restaurée (clés persistées).
- [ ] Scan externe : seuls 22/80/443 (+ 21115–21119 en phase RustDesk) ouverts ; 3260, 3000 et 5432 invisibles de l'extérieur.
- [ ] Domaines témoins du VPS toujours en 200 après chaque étape (non-régression).
- [ ] Sauvegardes planifiées : `pg_dump` quotidien chiffré + archive volume hbbs (cron).

## 8. Intégration terminal (suite du projet — phase 02/03)

1. Agent Android (service d'accessibilité) : heartbeats réels → remplace le simulateur (`/api/simulator/tick` reste 503 en production).
2. Pont console ↔ hbbs : ouverture/clôture de sessions réelles, exécution des 8 commandes via un canal signé.
3. FastAPI (phase 03) : reprise du contrat `README §Contrat d'API` — les types et règles de refus actuels en sont la spécification exécutable.
