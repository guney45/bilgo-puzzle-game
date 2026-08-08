# 06 — Geliştirme, Test, Deploy, İzleme

---

## 1. Geliştirme ortamı

**Gereksinimler:** Node.js 22 LTS, pnpm 9+, Git. (Docker gerekmez.)

```bash
pnpm install
pnpm dev            # client :5173 + server :2567
pnpm dev --host     # telefondan test için: http://<bilgisayar-ip>:5173
pnpm typecheck
pnpm test
pnpm build
```

**Ortam değişkenleri**

| Değişken | Yer | Örnek |
|---|---|---|
| `VITE_SERVER_URL` | client | `ws://localhost:2567` / `wss://api.oyun.com` |
| `PORT` | server | `2567` |
| `ALLOWED_ORIGINS` | server | `http://localhost:5173,https://oyun.com` |
| `NODE_ENV` | server | `development` / `production` |

**Telefondan yerel test:** Bilgisayar ve telefon aynı Wi-Fi'da olmalı; `--host` ile
açılan IP'yi telefonda aç. `VITE_SERVER_URL`'i de aynı IP'ye ayarla (yoksa telefon
`localhost`'a bağlanmaya çalışır — en sık yapılan hata).

---

## 2. Test stratejisi

| Katman | Araç | Neyi test eder |
|---|---|---|
| Birim | Vitest | `scoring.ts` (tablo bazlı), `rng.ts` (determinizm), `roomCode.ts`, puzzle üreticileri (1000 üretim doğrulaması), `MatchController` faz geçişleri |
| Entegrasyon | `@colyseus/testing` | 2–4 client ile: katılma, lobi, tam maç, erken bitiş, rematch, kopma/dönme, kötü payload reddi |
| Duman/yük | `scripts/bots.ts` | N bot ile eşzamanlı oda; sunucu CPU/bellek davranışı |
| Manuel cihaz | Elle | iOS Safari, Android Chrome, masaüstü Chrome/Firefox; dikey+yatay; zayıf ağ (Chrome DevTools "Slow 4G") |

**Ajan için kural:** Her fazın sonunda `pnpm typecheck && pnpm test && pnpm build`
çalıştırılır; kırmızıysa faz bitmemiştir.

**Kritik regresyon testleri (asla silinmez):**
1. `correctChoiceId` hiçbir `round:puzzle` mesajında bulunmaz.
2. `revealAt` öncesi gelen cevap reddedilir.
3. Aynı turda ikinci cevap yok sayılır ve skoru değiştirmez.
4. Yüksek RTT'li client, düşük RTT'liyle aynı gerçek sürede cevapladığında ≥ %95 aynı puanı alır.
5. Bir client bağlantı koparsa maç diğerleri için devam eder.

---

## 3. CI (GitHub Actions, opsiyonel ama önerilir)

`.github/workflows/ci.yml`: push ve PR'da → `pnpm install --frozen-lockfile`,
`typecheck`, `test`, `build`. 5 dakikalık kurulum, sonradan gelen "bir şeyi
bozdum ama fark etmedim" saatlerini kurtarır.

---

## 4. Deploy

### 4.1 Mimarinin şekli

```
Tarayıcı ──HTTPS──► Statik host (CDN)        : client build (dist/)
        ──WSS ────► Kalıcı Node process      : Colyseus sunucusu
```

### 4.2 ⚠️ En sık yapılan hata

**Vercel/Netlify serverless fonksiyonları kalıcı WebSocket tutamaz.** Colyseus
sunucusunu oraya koyamazsın. Frontend orada durabilir, backend **kalıcı process**
çalıştıran bir yerde olmalı.

### 4.3 Seçenekler

| Katman | Seçenek | Not |
|---|---|---|
| Frontend | Cloudflare Pages / Netlify / Vercel | Statik `dist/`, ücretsiz katman fazlasıyla yeter |
| Backend | **Fly.io** | Bölge seçimi iyi (Frankfurt/İstanbul yakını = düşük gecikme), küçük makine ~5 USD/ay |
| Backend | **Railway / Render** | Kurulumu en kolay; Render ücretsiz katmanda uyur (ilk bağlantı gecikir) |
| Backend | **Hetzner / DigitalOcean VPS** | En ucuz ve tam kontrol; Caddy ile TLS, systemd ile servis |
| Backend | **Colyseus Cloud** | Sıfır ops, en pahalı seçenek |

**Gecikme notu:** Oyuncuların çoğu Türkiye'deyse sunucu **Frankfurt/Amsterdam**
olmalı (~35–50 ms). ABD'de olursa +120 ms gelir ve hissedilir.

### 4.4 Deploy kontrol listesi

- [ ] `wss://` kullanılıyor (https sayfadan `ws://` tarayıcı tarafından bloklanır)
- [ ] `ALLOWED_ORIGINS` prod domainini içeriyor
- [ ] Health endpoint `/health` ayakta, platform buna göre restart ediyor
- [ ] Graceful shutdown: `gracefullyShutdown()` ile aktif odalara bilgi
- [ ] Sunucu tek instance (MVP). Birden fazla instance = Redis presence/driver gerekir; **erken yapma**
- [ ] Client `VITE_SERVER_URL` build zamanında doğru
- [ ] Prod'da source map kapalı
- [ ] Basit uptime kontrolü (UptimeRobot vb.)

### 4.5 Ölçekleme (gerekirse)

Tek 1 vCPU / 512 MB makine ~200 oda / ~800 oyuncu taşır (odalar hafızada, tick yok).
Bunun üstü için: yatay ölçekleme + Redis presence/driver + sticky yönlendirme.
**Bu problemi yaşamadan çözmeye çalışma.**

---

## 5. İzleme ve tanılama

- **Yapısal log** (JSON): oda kurma/kapanma, maç başlangıç/bitiş (`matchSeed` ile!), reddedilen mesajlar, reconnect olayları. `matchSeed` sayesinde "şu maçtaki 3. soru saçmaydı" şikâyetini birebir yeniden üretebilirsin.
- **Metrikler (basit sayaçlar yeter):** aktif oda, aktif oyuncu, maç/saat, ortalama maç süresi, tur başına ortalama cevap süresi, tip başına doğru cevap oranı.
- **Puzzle kalitesi sinyali:** bir puzzle tipinde doğru oranı > %90 → çok kolay; < %25 → çok zor veya hatalı. Faz 12'de bu veriyle içerik dengele.
- **Hata takibi:** Sentry ücretsiz katmanı (client + server) — opsiyonel ama ucuz sigorta.
- **Gizlilik:** Kişisel veri toplanmıyor (hesap yok). Takma adları loglama, sadece `playerId`. Böylece KVKK/GDPR yüzeyi neredeyse sıfır kalır.

---

## 6. Maliyet tahmini (MVP)

| Kalem | Aylık |
|---|---|
| Frontend hosting | 0 USD |
| Backend (Fly.io shared-cpu-1x) | ~5 USD |
| Domain | ~1 USD (yıllık ~12) |
| İzleme | 0 USD |
| **Toplam** | **~6 USD/ay** |

---

## 7. Sürüm ve dallanma

- `main` her zaman çalışır durumda; faz dalları: `phase-4-pattern-puzzles`.
- Commit formatı: `feat(phase-N): ...`, `fix: ...`, `chore: ...`.
- Her faz sonunda tag: `v0.1-phase-6-mvp`.
- Ajan çalışmadan önce **temiz bir çalışma ağacı** olsun; böylece `git diff` ile
  ne yaptığını tek bakışta görürsün.
