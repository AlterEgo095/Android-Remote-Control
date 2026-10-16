# Audit du VPS (lecture seule) — Android Remote Control v1.0

> **Statut : À EXÉCUTER SUR LE VPS.** Le sandbox de développement n'a **pas d'accès** au VPS Ubuntu 24.04 — aucun résultat n'est donc inventé ici. Cet artefact fournit la procédure 100 % lecture seule et le modèle de rapport à compléter avant tout déploiement.

## 1. Procédure

```bash
# Sur le VPS, depuis le dépôt cloné (ou copiez uniquement deploy/vps-audit.sh) :
sudo bash deploy/vps-audit.sh
```

Le script (`deploy/vps-audit.sh`) **n'installe rien, ne modifie rien, ne redémarre rien** et ne collecte aucune donnée sensible (les chemins de clés SSL sont masqués). Il produit `arc-vps-audit-AAAAMMJJ-HHMMSS.txt`.

## 2. Points examinés

| Domaine | Commandes utilisées | Décision dépendante |
|---|---|---|
| Ressources | `nproc`, `free -m`, `df -h` | capacité console + PostgreSQL + 2 RustDesk (~1 Go RAM total) |
| Docker / Compose | `docker --version`, `docker compose version` | compatibilité compose v2 (`name:`, `condition: service_healthy`) |
| Conteneurs en cours | `docker ps -a` | détection des noms/ports `arc-*` |
| Ports | `ss -tulpn` | **3000** (console, local), **21115–21119** (RustDesk), **5432** (ne doit pas être publié) |
| Nginx | version, `sites-enabled`, `server_name/listen/proxy_pass` | réutilisation de l'infra existante |
| DNS & TLS | `dig`, `getent`, `openssl s_client :443` | émission certbot possible (pas d'émission pendant l'audit) |
| Pare-feu | `ufw status`, `iptables -L` | ouverture future 21115–21119 + 80/443 |
| Répertoires | `/opt`, `/srv`, `/var/www`, `~` | emplacement du dépôt (`/opt/android-remote-control` conseillé) |
| Conflits | conteneurs `arc-*`, ports ci-dessus | GO/NO-GO déploiement |

## 3. Modèle de rapport à compléter (résultats à coller)

```
=== SYSTÈME ===        Ubuntu 24.04.x — kernel … — uptime … — nproc … — RAM …/… — disque libre …
=== DOCKER ===         docker … — compose … — conteneurs actifs : …
=== PORTS ===          80:(libre/nginx) 443:(libre/nginx) 3000:(LIBRE/occupé par …)
                       5432:(LIBRE/…) 21115-21119:(LIBRES/…)
=== NGINX ===          version … — sites actifs : … — conflits server_name android.aenews.online : NON/OUI
=== DNS ===            android.aenews.online → A … / AAAA … (pointe vers ce VPS : OUI/NON)
=== TLS ===            certificat existant : OUI(expire …)/NON → certbot à prévoir
=== PARE-FEU ===       ufw : active/inactive — règles entrantes : …
=== CONFLITS arc-* === AUCUN / …
=== DISQUE ===         espace /var/lib/docker : … (besoin estimé : ~2 Go)
GO / NO-GO : …
```

## 4. Critères de GO

1. `docker compose v2` présent.
2. Ports 3000 (en écoute locale uniquement), 21115–21119 libres (ou RustDesk déjà déployé par ce projet).
3. ≥ 1 Go RAM libre et ≥ 2 Go disque.
4. DNS `android.aenews.online` → IP du VPS (ou décision de le créer — hors périmètre de l'audit, section 13 : « Ne modifie pas le DNS »).
5. Aucun `server_name` en conflit, aucun conteneur `arc-*` existant.

En cas de NO-GO sur un point : consigner et ajuster le plan (`docs/PLAN-DEPLOIEMENT.md` §0) avant toute opération.
