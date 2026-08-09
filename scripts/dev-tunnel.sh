#!/usr/bin/env bash
#
# Telefonda test için iki geçici Cloudflare tüneli açar (bkz. docs/DECISIONS.md ADR-015).
# Yerel ağda telefon→Mac WebSocket upgrade'i aradaki cihaz tarafından düşürüldüğü
# için oyun LAN IP'si üzerinden çalışmıyor; tünel wss:// kullandığından bu sorunu
# aşar ve HTTPS sayesinde clipboard/share API'leri de çalışır.
#
# Kullanım:  pnpm tunnel     (ayrı bir terminalde:  pnpm dev)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/packages/client/.env"
LOG_DIR="$(mktemp -d)"

# VITE_SERVER_URL yokken client, sayfanın yüklendiği host'a DEFAULT_SERVER_PORT ile
# bağlanır (bkz. packages/client/src/net/colyseus.ts) — yerel geliştirmenin varsayılanı budur.
LOCAL_ENV_CONTENT="# Tünel kullanılmıyorken boş bırakılır: client, sayfanın yüklendiği host'a :2567 ile bağlanır.
# 'pnpm tunnel' çalışırken bu dosyaya geçici tünel adresi yazılır.
"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared bulunamadı. Kurmak için:  brew install cloudflared" >&2
  exit 1
fi

cleanup() {
  echo ""
  echo "Tüneller kapatılıyor…"
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  [[ -n "${CLIENT_PID:-}" ]] && kill "$CLIENT_PID" 2>/dev/null || true
  # Ölü tünel adresi .env'de kalırsa sonraki 'pnpm dev' bozuk sunucuya bağlanmaya
  # çalışır — yerel varsayılana geri dön.
  printf '%s' "$LOCAL_ENV_CONTENT" > "$ENV_FILE"
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT INT TERM

cloudflared tunnel --url http://localhost:2567 --no-autoupdate > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
cloudflared tunnel --url http://localhost:5173 --no-autoupdate > "$LOG_DIR/client.log" 2>&1 &
CLIENT_PID=$!

# Quick tunnel adresi rastgele üretilir ve yalnızca log'a yazılır; başka yolu yok.
wait_for_url() {
  local file="$1" url=""
  for _ in $(seq 1 60); do
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$file" 2>/dev/null | head -1 || true)"
    if [[ -n "$url" ]]; then
      echo "$url"
      return 0
    fi
    sleep 1
  done
  return 1
}

SERVER_URL="$(wait_for_url "$LOG_DIR/server.log")" || { echo "Sunucu tüneli açılamadı." >&2; exit 1; }
CLIENT_URL="$(wait_for_url "$LOG_DIR/client.log")" || { echo "Client tüneli açılamadı." >&2; exit 1; }

printf 'VITE_SERVER_URL=%s\n' "$SERVER_URL" > "$ENV_FILE"

cat <<EOF

  ────────────────────────────────────────────────────────────
   TELEFONDA AÇ:
   $CLIENT_URL

   Oyun sunucusu : $SERVER_URL
   packages/client/.env güncellendi.
  ────────────────────────────────────────────────────────────

   Şimdi BAŞKA bir terminalde:   pnpm dev
   (pnpm dev zaten çalışıyorsa yeniden başlat — .env yeni okunmalı.)

   Kapatmak için: Ctrl+C
EOF

wait
