#!/usr/bin/env bash
# Health check 90 & Goal — verifica che la PRODUZIONE punti al DB giusto e che il login funzioni.
# Uso:  ./scripts/healthcheck.sh
# Richiede in .env.local: ADMIN_EMAIL, ADMIN_PASSWORD (già impostati).
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="https://90egoal.vercel.app"
EXPECTED_DB="jzxeasfovkigtyptspan"   # <-- database corretto di 90 & Goal
WRONG_DB="nxknk"                     # <-- database di Marco OS (NON deve comparire)

ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' .env.local | cut -d= -f2- | tr -d '"' || true)
ADMIN_PASSWORD=$(grep -E '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"' || true)

echo "🔎 Health check 90 & Goal — $(date '+%Y-%m-%d %H:%M')"
echo "----------------------------------------------------"

# 1) A quale DB punta la produzione (estratto dai bundle JS del sito)
BUNDLE=$(curl -s "$SITE/auth/login" | grep -oaE '/_next/static/chunks/[^\"]+\.js' | sort -u \
         | while read -r ch; do curl -s "$SITE$ch"; done)
PROD_URL=$(printf '%s' "$BUNDLE" | grep -oaE 'https://[a-z0-9]+\.supabase\.co' | sort -u | head -1)
PROD_ANON=$(printf '%s' "$BUNDLE" | grep -oaE 'sb_publishable_[A-Za-z0-9_-]+' | head -1)

echo "DB produzione : ${PROD_URL:-<non trovato>}"
if printf '%s' "$PROD_URL" | grep -q "$EXPECTED_DB"; then
  echo "  ✅ punta al database corretto (jzxeas)"
else
  echo "  ❌ ATTENZIONE: la produzione NON punta a jzxeas!"
  printf '%s' "$PROD_URL" | grep -q "$WRONG_DB" && echo "     → sta puntando al DB di Marco OS (nxknk). Correggi le env su Vercel."
  exit 1
fi

# 2) Login end-to-end con la stessa anon key del sito
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ] && [ -n "$PROD_ANON" ]; then
  CODE=$(curl -s -o /tmp/hc.json -w "%{http_code}" \
    -X POST "$PROD_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $PROD_ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
  if [ "$CODE" = "200" ] && grep -q access_token /tmp/hc.json; then
    echo "Login admin   : ✅ OK (HTTP 200, token valido)"
  else
    echo "Login admin   : ❌ FALLITO (HTTP $CODE) — $(head -c 120 /tmp/hc.json)"
    exit 1
  fi
else
  echo "Login admin   : ⏭️  saltato (mancano ADMIN_EMAIL/ADMIN_PASSWORD in .env.local o anon key)"
fi

echo "----------------------------------------------------"
echo "✅ Tutto ok: produzione sul DB giusto e login funzionante."
