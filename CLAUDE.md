# CLAUDE.md — Ajan Kuralları (puzzle-race)

Bu repo, tarayıcı tabanlı rekabetçi multiplayer puzzle oyunudur.
Mimari bir işe başlamadan önce **oku**: `docs/01-PROJECT_BRIEF.md`,
`docs/03-ARCHITECTURE.md`, `docs/04-NETWORK_PROTOCOL.md`, **`docs/DECISIONS.md`**
(önceki fazlarda çıkan gerçek hatalar ve alınan kararlar — tekrar aynı hataya
düşmemek için önce bu okunur).
Oyun kuralı/sayı gerektiğinde: `docs/02-GAME_DESIGN.md`. Sırayla ilerle: `docs/05-ROADMAP.md`.

## Çalışma biçimi

1. Kod yazmadan önce **kısa bir plan** sun ve onay bekle.
2. Aynı anda **tek faz**. Yol haritasında sonraki fazın işini yapma.
3. Görevi çözen **en küçük** uygulamayı tercih et. Çalışan sistemi gereksiz yere yeniden yazma.
4. Bir gereksinim belirsizse **tahmin etme, sor**. Geçici bir değer şartsa `packages/shared/src/config.ts`'e sabit olarak koy ve söyle.
5. İş bitmeden önce: `pnpm typecheck && pnpm test && pnpm build` çalıştır, hataları düzelt.
6. Önemli mimari kararları `docs/DECISIONS.md`'ye ADR formatında yaz.

## Değişmez kurallar

- **Sunucu otoritedir.** Doğruluk, süre, puan, faz geçişi, sıralama yalnızca sunucuda hesaplanır. Client'tan skor/doğruluk/"kazandım" bilgisi kabul edilmez; protokolde böyle bir mesaj yoktur.
- **Doğru cevap tur bitene kadar tarayıcıya gitmez.** `correctChoiceId` state'e konmaz, `round:puzzle` ve `round:answerAck` içinde bulunmaz; yalnızca `round:result` ile gider.
- **Hassas veri Colyseus state'ine konmaz** (state herkese görünür). Aktif turun cevapları, şık permütasyonları ve `ServerPuzzle` state dışında tutulur.
- **Zaman:** Tüm süreler sunucu epoch ms'idir. Client sayaçları `phaseEndsAt - serverNow()` ile hesaplanır; `setInterval` ile eksiltme yapılmaz.
- **Sabitler tek yerde:** `packages/shared/src/config.ts`. UI, oda veya puzzle kodunda çıplak sayı olmaz.
- **Bağımlılık yönü:** `client → shared`, `server → shared`. `shared` içinde DOM veya Node API'si yok.
- **Katman ayrımı:** Puzzle mantığı ağ mantığını, ağ mantığı UI'ı bilmez. `MatchController` Colyseus'u import etmez.
- **Yeni puzzle tipi = 3 dosya** (generator + server registry + client registry). Bunun dışında dosyaya dokunman gerekiyorsa dur ve nedenini açıkla.
- **Gelen her client mesajı zod ile doğrulanır.** Reddedilen mesajda `error` gönderilir ve loglanır, sessizce yutulmaz.
- **Masaüstü ve mobil aynı oyun mantığını kullanır.** Ayrı mobil uygulama/kod yolu yok; fark yalnızca düzen ve girdi katmanında.
- **MVP'de yasak:** kimlik doğrulama, veritabanı, chat, mağaza, ilerleme sistemi, ikinci oyun modu, canvas oyun motoru (Phaser/Unity). Kullanıcı açıkça istemeden ekleme.

## Teknoloji notları

- Colyseus **0.17** kullanılıyor (`defineServer()`, `defineRoom()`, `onDrop()`, `onReconnect()`). API'yi hafızandan yazma — `docs.colyseus.io` ile doğrula.
- Client SDK paketi `colyseus.js` **değil**, `@colyseus/sdk`'dır (bkz. ADR-004). `colyseus.js@0.16.x` sunucunun 0.17 matchmake yanıt şekliyle uyumsuz.
- Server dev script'i `tsx watch` değil `nodemon --watch src` kullanır (bkz. ADR-007) — `tsx watch`, `node_modules`'ı da izleyip sonsuz restart döngüsüne giriyor.
- Client: React + TypeScript + Vite + Tailwind v4 + Zustand. Oyun motoru yok; görsel puzzle'lar kendi içlerinde SVG/canvas kullanabilir.
- Test: Vitest + `@colyseus/testing`.
- Paket yöneticisi: pnpm (workspace).

## Mobil (her UI işinde geçerli)

`100dvh` (asla `vh`), `env(safe-area-inset-*)`, `touch-action: manipulation`,
`overscroll-behavior: none`, dokunma hedefi ≥ 48 px, input font ≥ 16 px,
hover'a bağlı bilgi yok, `prefers-reduced-motion` desteklenir.
Ayrıntı: `docs/03-ARCHITECTURE.md` §10.

## Dil

Kullanıcı arayüzü metinleri Türkçe (`i18n/tr.ts` üzerinden, string'ler koda gömülmez).
Kod, tip, dosya ve değişken adları İngilizce. Kullanıcıyla iletişim Türkçe.
