# Déploiement VPS — Android Remote Control v1.0

Runbook correspondant au **plan de réalisation par phases**. Objectif : héberger les services sur le VPS Ubuntu 24.04 existant **sans perturber les applications déjà présentes**.

---

## Phase 01 — Audit préalable du VPS (ne rien modifier avant)

Inventaire à relever et consigner avant tout changement :

```bash
# Conteneurisation et ressources
docker --version && docker compose version
free -h && df -h && nproc

# Ports déjà occupés (conflits potentiels avec 3000, 5432, 21115–21119)
sudo ss -tulpn | grep -E ':(3000|5432|21115|21116|21117|21118|21119)\b'

# Pare-feu et reverse proxy existants
sudo ufw status verbose
sudo nginx -T 2>/dev/null | grep -E 'server_name|listen' | head -n 20

# Services actifs
systemctl list-units --type=service --state=running | head -n 30
```

**Points de vigilance** : conflits de ports (RustDesk 21115–21119 très souvent libres ; 3000 et 5432 rarement), règles ufw/iptables, autres instances PostgreSQL, espace disque pour les volumes Docker.

## Phase 02 — Déploiement RustDesk

1. Ouvrir les ports entrants : `21115/tcp`, `21116/tcp+udp`, `21117/tcp`, `21118/tcp`, `21119/tcp`.
2. `docker compose -f docker-compose.vps.yml up -d rustdesk-signalisation rustdesk-relais`.
3. Sur le téléphone **Android 14** : installer RustDesk → serveur ID = IP ou domaine du VPS → vérifier l'ID attribué.
4. Depuis **un autre réseau** (4G, pas le même Wi-Fi) : tester une session de contrôle visuel.
5. Noter l'ID RustDesk du téléphone : il servira à l'enregistrement dans la console.

## Phase 03 — Backend (transition prototype → FastAPI)

Le prototype Next.js matérialise le **contrat d'API** (voir README). Le backend Python doit reprendre :

- FastAPI + PostgreSQL 16 ; utilisateurs hachés (scrypt/argon2), rôles (ADMIN/OPERATEUR/LECTEUR) ;
- registre des appareils, sessions administratives, **registre des commandes autorisées** (mêmes 8 commandes et mêmes règles de refus) ;
- table d'audit avec les mêmes champs (`actor`, `action`, `targetType`, `targetId`, `decision`, `detail`, `ip`) ;
- intégration RustDesk dédiée : ouverture de session et flux visuel sont des développements spécifiques — ne pas confondre l'affichage d'un ID RustDesk avec une API de contrôle.

## Déploiement de la console

```bash
# Basculer Prisma en PostgreSQL (une seule fois avant le build)
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

# Fichier d'environnement (JAMAIS committé)
cat > .env <<'EOF'
POSTGRES_PASSWORD=<mot-de-passe-fort-unique>
EOF

docker compose -f docker-compose.vps.yml up -d --build console db
```

La console écoute sur `127.0.0.1:3000` : exposer uniquement derrière Nginx (TLS + authentification) ou un tunnel, jamais directement sur Internet.

## Phase 05 — Validation et durcissement

**Checklist reprise des critères d'acceptation v1 :**

- [ ] Le VPS héberge les services sans perturber les applications existantes (phase 01 : comparaison avant/après).
- [ ] Un téléphone autorisé est accessible depuis un réseau extérieur.
- [ ] L'écran peut être visualisé et les interactions compatibles fonctionnent.
- [ ] L'administrateur peut identifier les appareils et gérer les sessions.
- [ ] Les commandes refusées ou échouées sont correctement journalisées.
- [ ] **La révocation empêche l'accès** via la plateforme de gestion (tester immédiatement après révocation depuis le téléphone).
- [ ] Les secrets, données et ports d'administration ne sont pas exposés publiquement (`ss -tulpn`, scan externe).
- [ ] Le système redémarre correctement : `sudo reboot` puis vérifier `docker compose ps` et une session RustDesk.

**Durcissement complémentaire :**

- Changer les identifiants de démonstration (`admin / Arc@2024!`) dès la première connexion.
- `POSTGRES_PASSWORD` fort et unique ; `.env` en `chmod 600` ; jamais dans Git.
- Mises à jour automatiques de sécurité (`unattended-upgrades`) ; échec de login → alerte (rate-limit à prévoir côté FastAPI).
- Sauvegardes : `pg_dump` quotidien chiffré + snapshot des volumes RustDesk (`arc-rustdesk-hbbs` contient les clés du serveur — indispensable pour conserver les IDs des appareils).
- TLS partout (Nginx + Let's Encrypt) ; considérer fail2ban sur le port SSH.
