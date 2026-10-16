#!/usr/bin/env bash
# ============================================================================
# Android Remote Control — AUDIT DU VPS (LECTURE SEULE, 100 % sans danger)
#
# Ce script N'INSTALLE rien, NE MODIFIE rien, NE REDÉMARRE rien.
# Il collecte : ressources, Docker, conteneurs, ports, Nginx, DNS/TLS,
# pare-feu, répertoires et conflits potentiels pour android.aenews.online.
#
# Usage sur le VPS (Ubuntu 24.04) :
#   sudo bash deploy/vps-audit.sh
# (sudo requis pour ss/ufw/nginx ; sans sudo, certaines sections sont sautées)
# Le rapport est écrit : ./arc-vps-audit-YYYYMMDD-HHMMSS.txt
# Aucune donnée sensible (clés, mots de passe) n'est collectée.
# ============================================================================
set -u
OUT="arc-vps-audit-$(date +%Y%m%d-%H%M%S).txt"
section() { echo -e "\n\n===== $1 =====" | tee -a "$OUT" >/dev/null; }
run() { echo "\$ $1" | tee -a "$OUT" >/dev/null; eval "$1" 2>&1 | tee -a "$OUT" >/dev/null; }

echo "Audit VPS — Android Remote Control — $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | tee "$OUT"

section "SYSTÈME"
run "lsb_release -a 2>/dev/null || cat /etc/os-release"
run "uname -r"
run "uptime"
run "nproc"
run "free -m"
run "df -h / /var"

section "DOCKER"
run "docker --version 2>/dev/null || echo 'docker absent'"
run "docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo 'compose absent'"
run "docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"
run "docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'"
run "docker network ls"
run "docker volume ls"
run "docker system df"

section "PORTS EN ÉCOUTE (conflits potentiels : 80, 443, 3000, 5432, 21115-21119)"
run "ss -tulpn | sort -k5"

section "NGINX"
run "nginx -v 2>&1 || echo 'nginx absent'"
run "systemctl is-active nginx 2>/dev/null"
run "ls -la /etc/nginx/sites-enabled/ 2>/dev/null"
run "grep -R -nE 'server_name|listen |proxy_pass|ssl_certificate ' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | sed 's/ssl_certificate_key.*/ssl_certificate_key [MASQUÉ]/'"
run "nginx -t 2>&1"

section "DNS & TLS — android.aenews.online"
run "getent hosts android.aenews.online || echo 'RÉSOLUTION LOCALE ÉCHOUÉE'"
run "(dig +short A android.aenews.online; dig +short AAAA android.aenews.online) 2>/dev/null || echo 'dig indisponible'"
run "echo | timeout 8 openssl s_client -connect android.aenews.online:443 -servername android.aenews.online 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null || echo 'TLS : pas de certificat joignable sur :443'"

section "PARE-FEU"
run "ufw status verbose 2>/dev/null || echo 'ufw indisponible'"
run "iptables -L -n 2>/dev/null | head -40 || echo 'iptables inaccessible (sudo requis)'"

section "RÉPERTOIRES PROJETS"
run "ls -la /opt /srv /var/www /root 2>/dev/null | head -40"
run "ls -la ~/ 2>/dev/null | head -25"

section "VÉRIFICATIONS DE CONFLIT POUR ANDROID REMOTE CONTROL"
echo "— Port 3000 (console) :" | tee -a "$OUT"
run "ss -tlnp | grep ':3000 ' || echo '  LIBRE'"
echo "— Ports RustDesk 21115-21119 :" | tee -a "$OUT"
run "ss -tlnp | grep -E ':2111[5-9] ' || echo '  LIBRES'"
echo "— Port 5432 (PostgreSQL) :" | tee -a "$OUT"
run "ss -tlnp | grep ':5432 ' || echo '  LIBRE (PostgreSQL conteneurisé sans publication)'"
echo "— Conteneurs nommés arc-* :" | tee -a "$OUT"
run "docker ps -a --format '{{.Names}}' | grep -E '^arc-' || echo '  AUCUN'"

section "RESSOURCES LIBRES (estimation pour le nouveau service)"
run "docker system df 2>/dev/null"
run "df -h /var/lib/docker 2>/dev/null || df -h /"

echo -e "\n\nAudit terminé — rapport : $OUT" | tee -a "$OUT"
echo "Aucune modification n'a été effectuée (lecture seule)."
