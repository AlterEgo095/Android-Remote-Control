#!/bin/sh
# Android Remote Control — point d'entrée du conteneur console (production)
# 1. Migrations Prisma contrôlées : UNIQUEMENT si ARC_RUN_MIGRATIONS=1
#    (le seed de démonstration n'est JAMAIS exécuté ici — voir prisma/seed.ts).
# 2. Démarrage du serveur Next.js standalone.
# Toute erreur de migration interrompt le démarrage (set -e) : le conteneur
# redémarre avec un état de base connu, jamais incohérent.
set -e

SCHEMA="prisma/schema.prisma"
if [ "${ARC_DB_SCHEMA:-sqlite}" = "postgres" ]; then
  SCHEMA="prisma/postgres/schema.prisma"
fi

if [ "${ARC_RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[arc] Application des migrations Prisma (schéma : ${SCHEMA})…"
  bunx --bun prisma migrate deploy --schema "${SCHEMA}"
  echo "[arc] Migrations à jour."
fi

echo "[arc] Démarrage du serveur console (mode ${ARC_MODE:-simulation})…"
exec bun server.js
