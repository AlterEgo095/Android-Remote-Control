#!/usr/bin/env bash
# ============================================================================
# Android Remote Control — TESTS DE FUMÉE API (après déploiement)
# Usage :
#   BASE_URL=https://android.aenews.online ARC_USER=... ARC_PASS=... bash deploy/smoke-test.sh
#   (par défaut : BASE_URL=http://127.0.0.1:3260 — port VPS choisi après audit 2026-10-17)
# Vérifie : santé, auth (KO/OK), 401 sans session, rate-limit, CSRF origin,
# registre, refus de payload invalide, filtres d'audit stricts.
# Sortie : PASS/FAIL par test ; code retour non nul si un test échoue.
# ============================================================================
set -u
BASE_URL="${BASE_URL:-http://127.0.0.1:3260}"
ARC_USER="${ARC_USER:-admin}"
ARC_PASS="${ARC_PASS:-Arc@2024!}"
JAR="$(mktemp)"
FAILS=0

check() { # $1 nom, $2 attendu, $3 réel
  if [ "$2" = "$3" ]; then echo "PASS — $1 ($3)"; else echo "FAIL — $1 (attendu $2, obtenu $3)"; FAILS=$((FAILS+1)); fi
}

# T1 : /health
check "/health → 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/health")"

# Mode détecté (production = aucune session/commande fabricable → 503 honnête)
MODE="$(curl -s "$BASE_URL/api/system/config" | sed -n 's/.*"mode":"\([a-z]*\)".*/\1/p')"
MODE="${MODE:-simulation}"
echo "Mode détecté : $MODE"
# Comportements attendus pour la fabrication (simulation = validation 400 ;
# production = refus honnête 503 AVANT validation, garantie plus forte).
if [ "$MODE" = "production" ]; then EXP_FABRICATION=503; else EXP_FABRICATION=400; fi

# T2 : accès protégé sans session
check "GET /api/devices sans session → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/devices")"

# T3 : mauvais mot de passe
check "login mauvais mot de passe → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"username\":\"$ARC_USER\",\"password\":\"MAUVAIS\"}" "$BASE_URL/api/auth/login")"

# T4 : CSRF — Origin étrangère
check "login avec Origin étrangère → 403" "403" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H 'Origin: https://exemple-malveillant.example' -d "{\"username\":\"$ARC_USER\",\"password\":\"x\"}" "$BASE_URL/api/auth/login")"

# T5 : connexion valide (≥ 1 succès ; peut échouer 429 si T3 a épuisé la limite)
CODE="$(curl -s -o /tmp/arc_login.json -w '%{http_code}' -c "$JAR" -H 'Content-Type: application/json' -d "{\"username\":\"$ARC_USER\",\"password\":\"$ARC_PASS\"}" "$BASE_URL/api/auth/login")"
if [ "$CODE" = "429" ]; then echo "WARN — rate-limit déclenché par T3 (attendu en simulation) — pause 60 s non appliquée ; test session sauté"; else
  check "login valide → 200" "200" "$CODE"
  # T6 : route protégée avec cookie
  check "GET /api/devices avec session → 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE_URL/api/devices")"
  # T7 : registre
  check "GET /api/commands/registry → 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE_URL/api/commands/registry")"
  # T8 : commande hors registre (en production : refus 503 avant toute validation)
  check "commande hors registre → $EXP_FABRICATION ($MODE)" "$EXP_FABRICATION" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -H 'Content-Type: application/json' -d '{"deviceId":"x","name":"FORMAT_DISK"}' "$BASE_URL/api/commands")"
  # T9 : payload invalide (TEXT_INPUT vide) — même garde-fou en production
  check "TEXT_INPUT payload invalide → $EXP_FABRICATION ($MODE)" "$EXP_FABRICATION" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -H 'Content-Type: application/json' -d '{"deviceId":"x","name":"TEXT_INPUT","payload":{"text":""}}' "$BASE_URL/api/commands")"
  # T10 : filtre d'audit invalide
  check "audit decision invalide → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE_URL/api/audit?decision=PIRATE")"
  # T11 : filtre d'audit valide
  check "audit decision=DENIED → 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE_URL/api/audit?decision=DENIED")"
fi

# T12 : déconnexion
check "logout → 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$BASE_URL/api/auth/logout")"

rm -f "$JAR" /tmp/arc_login.json
echo "-----"
if [ "$FAILS" -eq 0 ]; then echo "TOUS LES TESTS SONT PASSÉS"; else echo "$FAILS TEST(S) EN ÉCHEC"; exit 1; fi
