# 05 — Yol Haritası ve Claude Code Promptları

Bu senin çalışma kılavuzun. Her faz: **ne yapılacak → bittiğini nasıl anlarsın →
ajana verilecek prompt → commit**.

---

## A. Claude Code ile çalışma kuralları (bunlara uy, projeyi bunlar kurtarır)

1. **Tek oturum = tek faz.** Faz bitince `/clear` yaz. Uzun bağlam = ajanın kalitesi düşer.
2. **Önce plan.** Prompt'un başında "önce planını söyle, onaylamadan kod yazma" de. (Shift+Tab ile plan modu da kullanabilirsin.)
3. **Her faz sonunda commit.** `git add -A && git commit -m "feat(phase-3): lobby"`. Bir şey bozulursa geri dönebilmek paha biçilmez.
4. **Kabul kriterini sen test et.** Ajan "bitti" der; sen tarayıcıda iki sekme açıp dener, mobilden de bakarsın.
5. **Kapsam kaçışına izin verme.** "Bu fazda sadece X var, Y'ye dokunma" cümlesini prompt'ta tut.
6. **Belge güncel kalsın.** Ajandan her fazda `docs/DECISIONS.md`'yi güncellemesini iste.
7. **Sayı gördüğün her yerde sor:** "Bu sabit `shared/src/config.ts`'te mi?" Değilse taşıt.
8. **Mobil testi ertelemeyin ama biriktirmeyin.** Faz 4'ten itibaren telefondan da bak (`vite --host` + yerel ağ IP'si).

---

## B. Fazlar

Her fazın "Kabul" satırı, senin elle doğrulayacağın şeydir.

### FAZ 0 — İskelet ve araçlar
**Çıktı:** pnpm workspace, 3 paket, TS/ESLint/Prettier, dev script'leri, boş health endpoint, client'tan sunucuya WS bağlantısı.
**Kabul:** `pnpm dev` tek komutla hem client (5173) hem server (2567) ayağa kalkar; tarayıcı konsolunda "connected" yazar; `pnpm typecheck` ve `pnpm test` hatasız çalışır.

```
Projeye docs/ klasöründeki 01-PROJECT_BRIEF.md, 03-ARCHITECTURE.md ve 04-NETWORK_PROTOCOL.md dosyalarını oku, CLAUDE.md'yi de oku. Sonra FAZ 0'ı yap.

FAZ 0 kapsamı (SADECE bu):
- pnpm workspace kur: packages/shared, packages/server, packages/client
- TypeScript 5.x strict, ESLint + Prettier, her pakette build/typecheck script'i
- shared: boş iskelet + config.ts içinde 02-GAME_DESIGN.md §6'daki sabitler
- server: Colyseus 0.17 ile defineServer, "game" adında boş bir GameRoom, GET /health endpoint'i
- client: Vite + React + TS + Tailwind v4; açılışta colyseus.js ile sunucuya bağlanıp konsola log basan minimal ekran
- kök package.json'da "dev" script'i ikisini birden çalıştırsın (concurrently)
- .env.example: VITE_SERVER_URL, PORT
- Vitest kurulumu + shared için bir örnek test

ÖNEMLİ: Colyseus 0.17 API'sini docs.colyseus.io'dan doğrula, hafızandan eski API (gameServer.define) yazma. Önce planını yaz, onayımı bekle. Puzzle, lobi, oyun mantığı YOK.
```
Commit: `chore(phase-0): monorepo skeleton`

---

### FAZ 1 — Oda kurma, oda kodu, katılma
**Çıktı:** `roomCode` üretimi, `filterBy`, `setPrivate`, join/create akışı, `room:welcome`, hata kodları, takma ad doğrulama, Home ekranı.
**Kabul:** İki tarayıcı sekmesinde: A oda kurar ve 5 haneli kodu görür; B kodu yazıp girer; ikisi de birbirinin adını görür. Yanlış kod → "Böyle bir oda bulunamadı."

```
FAZ 1: Oda kurma ve katılma. docs/04-NETWORK_PROTOCOL.md'deki sözleşmeye birebir uy.

Kapsam:
- shared/roomCode.ts: 02-GAME_DESIGN.md §6'daki alfabeyle 5 karakterlik kod üretimi + doğrulama + normalizasyon (büyük harfe çevirme)
- shared/messages.ts + schemas.ts: protokol dosyasındaki TÜM tipleri şimdiden tanımla, ama bu fazda sadece room:welcome, error, player:setNickname kullanılsın
- server: GameRoom onCreate'te kod üretimi (çakışma kontrolü), setPrivate(), metadata; defineRoom(GameRoom).filterBy(['roomCode'])
- server: onJoin'de nickname sanitize (1-14 char), GameState + PlayerSchema (03-ARCHITECTURE.md §6)
- server: E_ROOM_NOT_FOUND / E_ROOM_FULL / E_INVALID_NICKNAME
- client: Home ekranı (takma ad + ODA KUR + kod alanı + KATIL), URL'deki ?r= parametresini oku ve kod alanını doldur
- client: net/colyseus.ts (bağlantı yönetimi), useRoomState hook'u, i18n/tr.ts ile Türkçe hata metinleri
- test: @colyseus/testing ile "iki client aynı odaya kodla girer" entegrasyon testi

Kapsam dışı: lobi hazır durumu, host, puzzle, puanlama. Önce plan.
```
Commit: `feat(phase-1): room create/join with codes`

---

### FAZ 2 — Lobi, hazır durumu, host, davet
**Çıktı:** Lobby ekranı, ready toggle, host devri, davet linki + kopyala/paylaş + QR, oyuncu giriş/çıkış bildirimleri.
**Kabul:** 3 sekmede oyuncu listesi anlık güncellenir; host çıkınca host başkasına geçer; QR'ı telefonla okutunca oda kodu dolu olarak açılır.

```
FAZ 2: Lobi. Kapsam:
- server: player:ready mesajı, hostId yönetimi, host düşerse en düşük joinIndex'li bağlı oyuncuya devir, room:notice bildirimleri
- server: MAX_PLAYERS kontrolü
- client: Lobby ekranı — oda kodu büyük punto, davet linki (navigator.share varsa PAYLAŞ, yoksa KOPYALA), QR kod (hafif bir kütüphane), oyuncu listesi (hazır/host/bağlantı durumu ikonları), HAZIR butonu, host için BAŞLAT (şimdilik pasif)
- client: 03-ARCHITECTURE.md §10'daki mobil kontrol listesinin TAMAMINI uygula (dvh, safe-area, touch-action, overscroll, viewport meta, 16px input)
- client: temel tasarım sistemi — koyu tema, tek vurgu rengi, buton/kart bileşenleri, 02-GAME_DESIGN.md §7.3'e uygun

Kapsam dışı: maç başlatma mantığı, puzzle. Önce plan.
```
Commit: `feat(phase-2): lobby, host, invite link`

---

### FAZ 3 — Faz makinesi ve saat senkronizasyonu
**Çıktı:** `MatchController` (Colyseus'tan bağımsız), faz geçişleri, `phaseEndsAt`, ping/pong saat senkronu, client sayaç bileşeni.
**Kabul:** BAŞLAT'a basınca tüm sekmelerde 3-2-1 aynı anda akar; bir sekmeyi arka plana atıp geri gelince sayaç doğru değerdedir; sahte puzzle fazı süresi bitince kendiliğinden ilerler.

```
FAZ 3: Faz makinesi + zaman senkronu. Bu fazın kalbi 03-ARCHITECTURE.md §7.

Kapsam:
- server/rooms/MatchController.ts: LOBBY→COUNTDOWN→REVEAL→PLAYING→LOCKED→ROUND_RESULT→GAME_RESULT geçişleri. Colyseus import ETMEYECEK (saf sınıf, birim testi yazılabilir olsun). GameRoom bu sınıfı sarmalar ve state'e yansıtır.
- server: match:start doğrulaması (host mu, >=2 bağlı oyuncu mu, faz LOBBY mi)
- server: net:ping/net:pong; her client için RTT tahmini sakla (son 5 örneğin minimumu)
- client: net/clockSync.ts — offset hesabı (5 örnek, en küçük RTT'li), serverNow()
- client: Timer bileşeni — requestAnimationFrame + phaseEndsAt - serverNow(), setInterval ile eksiltme YOK
- client: Countdown ekranı
- geçici olarak PLAYING fazında "sahte puzzle" placeholder'ı göster (gerçek puzzle Faz 4'te)
- test: MatchController için birim testleri (faz geçişleri, erken bitiş)

Kapsam dışı: gerçek puzzle içeriği, puanlama. Önce plan.
```
Commit: `feat(phase-3): match state machine + clock sync`

---

### FAZ 4 — İlk puzzle tipi (PATTERN) uçtan uca
**Çıktı:** `PuzzleGenerator` arayüzü, `pattern.ts` üretici, registry, `ClientPuzzle` dönüşümü + kişiye özel şık karıştırma, `round:puzzle`, MultipleChoice renderer, `round:answer` + `answerAck`.
**Kabul:** İki cihazda aynı soru ±150 ms içinde açılır (konsola `revealAt` farkını logla); şık sıraları farklıdır; cevap verince şık kilitlenir ve doğruluk **görünmez**; DevTools Network'te doğru cevap **yoktur**.

```
FAZ 4: İlk gerçek puzzle (PATTERN) uçtan uca. docs/03-ARCHITECTURE.md §5 ve 02-GAME_DESIGN.md §3.1'e uy.

Kapsam:
- shared/puzzle.ts: ServerPuzzle / ClientPuzzle / PuzzleType tipleri
- shared/rng.ts: mulberry32 tohumlu RNG + tohumlu shuffle
- server/puzzles/PuzzleGenerator.ts arayüzü + registry.ts
- server/puzzles/pattern.ts: zorluk 1/2/3 için kural aileleri (GDD §3.1), 4 şık, çeldiriciler ("bir önceki kuralı uygulayan" tuzak şıkkı dahil), açıklama metni
- server: matchSeed + roundSeed; aynı maçta tekrar eden puzzle.id engeli
- server: toClientPuzzle() — correctChoiceId çıkarılır, şıklar OYUNCUYA ÖZEL karıştırılır, her oyuncuya ayrı ayrı gönderilir (broadcast değil)
- server: round:answer işleme — faz/puzzleId/tekrar/zamanlama doğrulaması, round:answerAck (doğruluk bilgisi YOK), state.answeredCount
- server: hepsi cevaplayınca ALL_ANSWERED_GRACE_MS sonra turu kilitle
- client: puzzles/registry.tsx + MultipleChoice.tsx renderer; Puzzle ekranı (tur/sayaç/mini skor + soru + 4 büyük şık)
- client: revealAt'a kadar soruyu gizle (kapalı kart), serverNow() ile aç
- test: pattern üreticisi için 1000 üretimde her zaman geçerli tek doğru cevap ve benzersiz şıklar olduğunu doğrulayan test

Kapsam dışı: puanlama, tur sonucu ekranı, diğer puzzle tipleri. Önce plan.
```
Commit: `feat(phase-4): pattern puzzles end-to-end`

---

### FAZ 5 — Puanlama ve tur sonucu
**Çıktı:** `shared/scoring.ts`, gecikme telafisi, bonuslar, `round:result`, RoundResult ekranı.
**Kabul:** Hızlı cevap daha çok puan getirir; mobil veriden bağlanan oyuncu Wi-Fi'lıya karşı sistematik olarak kaybetmez; tur sonucunda doğru cevap ve herkesin süresi görünür; puanlama birim testleri geçer.

```
FAZ 5: Puanlama + tur sonucu. 02-GAME_DESIGN.md §5 ve 03-ARCHITECTURE.md §7.3.

Kapsam:
- shared/scoring.ts: scoreAnswer({correct, answerMs, limitMs, roundMultiplier, modifier}) SAF fonksiyon; modifier parametresi şimdilik sadece 'NONE' kabul etsin ama imzada dursun
- shared/scoring.ts: bonuslar (FIRST_CORRECT, STREAK_3, STREAK_5), son tur 2x, beraberlik bozma karşılaştırıcısı
- server: answerMs hesabı gecikme telafisiyle (clamp formülü, TOLERANCE 80ms), E_TIMING reddi
- server: round:result mesajı (protokoldeki RoundResult tipi birebir)
- client: RoundResult ekranı — doğru cevap + açıklama, oyuncu satırları (süre, +puan, bonus rozetleri), güncel sıralama, 4 sn sonra otomatik geçiş
- test: scoring.ts için tablo bazlı birim testler (GDD §5.1'deki örnek değerler tutmalı)

Kapsam dışı: final ekranı, rematch. Önce plan.
```
Commit: `feat(phase-5): server-authoritative scoring`

---

### FAZ 6 — Çok turlu maç + final tablosu + rematch
**Çıktı:** 5 turluk döngü, zorluk eğrisi, `match:result`, GameResult ekranı, rematch akışı.
**Kabul:** **MVP senaryosu (01-PROJECT_BRIEF.md §4) baştan sona çalışır.** İki gerçek cihazda, farklı ağlarda dene.

```
FAZ 6: Tam maç döngüsü. Kapsam:
- server: ROUNDS_PER_MATCH turluk döngü, difficultyForRound(), aynı tip arka arkaya gelmesin kuralı
- server: match:result (standings + stats: en hızlı doğru, en çok doğru, en uzun seri) + matchSeed
- server: match:rematch — skorlar/seriler sıfırlanır, yeni matchSeed, lobiye dönülür, oda unlock
- client: GameResult ekranı (podyum animasyonu, istatistikler, TEKRAR OYNA)
- test: @colyseus/testing ile 3 client'ın tam 5 turluk maç oynadığı entegrasyon testi

Bu fazın sonunda docs/01-PROJECT_BRIEF.md §4'teki 10 maddelik MVP kabul listesini tek tek kontrol et ve sonucu rapor et. Önce plan.
```
Commit: `feat(phase-6): full match loop + rematch  🎉 MVP`

---

### FAZ 7 — Dayanıklılık: kopma, yeniden bağlanma, kenar durumlar
**Çıktı:** `onDrop`/`onReconnect`, 45 sn pencere, sessionStorage ile yenileme kurtarma, bağlantı overlay'i, oda ömrü, 1 kişi kalınca maç sonu.
**Kabul:** Maç ortasında telefonun uçak modunu 10 sn aç-kapa → oyun kaldığın yerden döner, diğer oyuncular donmaz. Sayfayı yenile → yine odaya dönersin.

```
FAZ 7: Bağlantı dayanıklılığı. 03-ARCHITECTURE.md §8'deki tabloyu birebir uygula.

Kapsam:
- server: onDrop → connected=false + allowReconnection(45); onReconnect → geri alma; 45 sn sonrası davranış (lobide sil, maçta "ayrıldı" bırak)
- server: host devri (kopma durumunda da), tek oyuncu kalınca 10 sn içinde maçı sonlandır, boş oda 120 sn sonra dispose (autoDispose=false)
- client: sessionStorage'a roomId+sessionId, açılışta client.reconnect() denemesi
- client: "Bağlantı koptu / Yeniden bağlanılıyor / Odaya dönüldü" overlay'leri, online-offline ve visibilitychange dinleyicileri
- test: bağlantı kopması ve dönüşü simüle eden entegrasyon testi

Önce plan.
```
Commit: `feat(phase-7): reconnection & resilience`

---

### FAZ 8 — Güvenlik sertleştirme + botlar
**Çıktı:** zod doğrulaması her mesajda, hız limitleri, origin kontrolü, sanitize, bot script'i.
**Kabul:** `scripts/bots.ts` ile 4 bot maç oynatabilirsin; kötü payload gönderen bir script sunucuyu bozamaz; hızlı mesaj gönderen client rate-limit yer.

```
FAZ 8: Güvenlik + test botları. 03-ARCHITECTURE.md §9 tablosunun tamamı.

Kapsam:
- server/security: her client mesajı için zod doğrulaması, hız limiti (20/sn uyarı, 50/sn kapat), IP başına oda kurma ve başarısız katılım limitleri, WS origin beyaz listesi
- server: nickname sanitize (zero-width, kontrol karakterleri, trim, boşsa Oyuncu-N)
- scripts/bots.ts: N sanal oyuncuyu odaya sokup rastgele/gecikmeli cevap verdiren CLI script'i (tek başına test edebilmen için)
- kötü niyetli payload testleri (yanlış tip, eksik alan, aşırı uzun string, eski puzzleId, çift cevap, negatif zaman)

Önce plan.
```
Commit: `feat(phase-8): hardening + test bots`

---

### FAZ 9 — Cila: mobil UX, ses, animasyon, i18n
**Çıktı:** Gerçek cihaz turu, ses efektleri, mikro animasyonlar, `prefers-reduced-motion`, wake lock, haptik, tam Türkçe metin geçişi.
**Kabul:** iPhone Safari ve Android Chrome'da tam bir maç sorunsuz; ekran uykuya dalmıyor; sesler ilk dokunuştan sonra çalışıyor; hiçbir yerde İngilizce sızıntı yok.

```
FAZ 9: Cila. Kapsam:
- ses: cevap, tur sonu, geri sayım, kazanma (kısa, küçük dosyalar), ilk dokunuşta AudioContext unlock, ses aç/kapa tercihi localStorage
- animasyon: faz geçişleri 150-250ms, skor sayaç animasyonu, prefers-reduced-motion desteği
- wake lock, haptik (navigator.vibrate)
- i18n: tüm metinler tr.ts üzerinden, en.ts iskeleti hazır
- gerçek cihaz kontrol listesi: 03-ARCHITECTURE.md §10'un 12 maddesini tek tek doğrula ve rapor et
- performans: prod bundle < 250KB gzip doğrula (rapor et), gereksiz bağımlılık varsa çıkar

Önce plan.
```
Commit: `feat(phase-9): polish, audio, i18n`

---

### FAZ 10 — Yeni puzzle tipleri (mimarinin sınavı)
**Çıktı:** `MEMORY`, `SPATIAL`, `ODD_ONE_OUT` + LOGIC içerik havuzu (120 soru).
**Kabul:** Her yeni tip **sadece 3 dosya** eklenerek/değiştirilerek geldi (generator + server registry + client registry). Protokol, puanlama, GameRoom, MatchController **hiç değişmedi**. Değiştiyse mimari borcu var demektir, düzelt.

```
FAZ 10: Yeni puzzle tipleri. GDD §3.2-3.5.

Sırayla ve ayrı commit'lerle:
1. LOGIC: content/logic.tr.json şeması (zod) + sunucu açılışında doğrulama + 30 örnek soru (zorluk 1/2/3 dengeli). Soruları üret ama "gözden geçirilmeli" notu bırak.
2. ODD_ONE_OUT: content/categories.tr.json (30 kategori × 8 öğe) + yarı prosedürel üretici
3. MEMORY: 3x3 ızgara, renk + ŞEKİL birlikte (renk körü güvenliği zorunlu), gösterim süresi sunucu zamanlı, client renderer'ı SVG ile
4. SPATIAL: SVG ile prosedürel şekil döndürme/simetri/eksik parça

KURAL: Bu fazda packages/shared/messages.ts, scoring.ts, server/rooms/* dosyalarına dokunman gerekiyorsa DUR ve bana nedenini açıkla — mimarinin genişletilebilirlik sınavı bu.
```
Commit: her tip için ayrı, `feat(puzzles): memory grid` vb.

---

### FAZ 11 — Rekabet derinliği (opsiyonel)
SAFE/RISK modifier'ı, emoji tepkileri, seri rozetleri, tur sonu "yakın takip" vurgusu.
**Kabul:** SAFE/RISK yalnızca `scoring.ts` + bir mesaj alanı + bir UI butonuyla geldi.

### FAZ 12 — Yayın (deploy) ve ölçüm
Statik frontend + kalıcı WS backend, custom domain, PWA manifest, basit anonim metrik.
**Kabul:** Arkadaşına link atıyorsun, o telefonundan giriyor ve maç oluyor.
Detaylar: `06-OPERATIONS.md`.

---

## C. Kilometre taşları

| Taş | Fazlar | Ne kazandın |
|---|---|---|
| **M1 — Bağlanıyoruz** | 0–2 | Aynı odaya girip birbirini görmek |
| **M2 — MVP** | 3–6 | Tam bir maç oynanıyor (projenin en kritik anı) |
| **M3 — Sağlam** | 7–9 | Gerçek dünyada, gerçek telefonlarda dayanıyor |
| **M4 — Oyun** | 10–11 | Tekrar tekrar oynanası içerik derinliği |
| **M5 — Canlı** | 12 | Arkadaşlarına link atabiliyorsun |

Faz 6'dan sonra **dur ve 4 arkadaşınla oyna**. Faz 10'daki içerik yatırımını
o oturumdan aldığın geri bildirime göre yönlendir.
