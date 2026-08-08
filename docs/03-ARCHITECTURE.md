# 03 — Teknik Mimari

> Bu dosya repo köküne kopyalanır. Mimari bir karar değişirse **buraya yazılır**.

---

## 1. Stack kararları (ve gerekçeleri)

| Katman | Seçim | Neden bu, neden diğerleri değil |
|---|---|---|
| Client framework | **React 19 + TypeScript** | Oyun %90 arayüz. Bileşen bazlı ekran yönetimi, hazır ekosistem. |
| Build | **Vite 6+** | Hızlı dev server, küçük prod bundle, TS yerleşik. |
| Stil | **Tailwind CSS v4** | Responsive/mobil düzen hızlı; ayrı CSS dosyası yönetimi yok. |
| Client state | **Zustand** | Colyseus zaten sunucu state'ini taşıyor; yerel UI state'i için Redux fazla ağır. |
| Ağ / oyun sunucusu | **Colyseus 0.17 + Node.js 22 LTS + TypeScript** | Oda, matchmaking, state senkronu, reconnection hazır. Ham `ws` ile bunları yeniden yazmak 2 hafta. |
| Doğrulama | **zod** | Sunucuya gelen her mesaj ve içerik JSON'u şemayla doğrulanır. |
| Test | **Vitest** + **@colyseus/testing** | Saf fonksiyon testleri + çok-client entegrasyon testi. |
| Monorepo | **pnpm workspaces** | `client` / `server` / `shared` aynı repoda, tek `pnpm i`. |
| Canvas/oyun motoru | **YOK** (MVP) | Bkz. aşağıdaki not. |

**Phaser/Unity neden yok:** Bu oyunun ekranları metin, buton ve liste. Canvas motoru
responsive metin düzeni, mobil klavye, kopyala-yapıştır ve erişilebilirliği elle
çözmeni ister; bundle'ı büyütür (ilk açılış = sürtünme = ürünün 1 numaralı riski).
İleride `MEMORY`/`SPATIAL` gibi görsel puzzle'lar **kendi içlerinde** SVG veya
`<canvas>` kullanır — motor değil, tek bileşen.

**Colyseus API notu (ajan için):** 0.17 ile API değişti (`defineServer()` +
`defineRoom()`, `onDrop()`/`onReconnect()`). Kod yazmadan önce `docs.colyseus.io`
kontrol edilir; hafızadan eski `gameServer.define(...)` yazılmaz.

---

## 2. Repo yapısı

```
puzzle-race/
├── CLAUDE.md                  # ajan kuralları
├── package.json               # workspace kökü
├── pnpm-workspace.yaml
├── docs/                      # bu doküman seti
│   ├── 01-PROJECT_BRIEF.md
│   ├── 02-GAME_DESIGN.md
│   ├── 03-ARCHITECTURE.md
│   ├── 04-NETWORK_PROTOCOL.md
│   ├── 05-ROADMAP.md
│   ├── 06-OPERATIONS.md
│   └── DECISIONS.md           # ADR günlüğü (ajan buraya yazar)
│
├── packages/
│   ├── shared/                # HER İKİ TARAFIN kullandığı tek gerçek kaynak
│   │   └── src/
│   │       ├── config.ts          # tüm sayısal sabitler
│   │       ├── types.ts           # GamePhase, PlayerView, RoundResult...
│   │       ├── messages.ts        # client→server / server→client mesaj tipleri
│   │       ├── schemas.ts         # zod şemaları (mesaj doğrulama)
│   │       ├── puzzle.ts          # ServerPuzzle / ClientPuzzle / PuzzleType
│   │       ├── scoring.ts         # SAF puanlama fonksiyonları
│   │       ├── rng.ts             # tohumlu RNG (mulberry32) + shuffle
│   │       ├── roomCode.ts        # kod üretimi/doğrulama
│   │       └── index.ts
│   │
│   ├── server/
│   │   └── src/
│   │       ├── index.ts           # defineServer, express health endpoint
│   │       ├── rooms/
│   │       │   ├── GameRoom.ts        # sadece yaşam döngüsü + mesaj yönlendirme
│   │       │   ├── state.ts           # Colyseus Schema sınıfları
│   │       │   └── MatchController.ts # faz makinesi (saf mantık, Colyseus'tan bağımsız)
│   │       ├── puzzles/
│   │       │   ├── registry.ts        # tip → generator eşlemesi
│   │       │   ├── PuzzleGenerator.ts # arayüz
│   │       │   ├── pattern.ts
│   │       │   ├── logic.ts
│   │       │   └── content/           # *.tr.json havuzları
│   │       ├── security/
│   │       │   ├── rateLimit.ts
│   │       │   └── sanitize.ts
│   │       └── util/clock.ts
│   │
│   └── client/
│       └── src/
│           ├── main.tsx
│           ├── net/
│           │   ├── colyseus.ts        # bağlantı, join/create/reconnect
│           │   ├── useRoomState.ts    # Colyseus state → React store
│           │   └── clockSync.ts       # sunucu saati offset'i
│           ├── screens/               # Home, Lobby, Countdown, Puzzle, RoundResult, GameResult
│           ├── components/            # Button, Timer, PlayerRow, QrCode, Overlay
│           ├── puzzles/               # tip → React renderer eşlemesi
│           │   ├── registry.tsx
│           │   ├── MultipleChoice.tsx
│           │   └── (sonra) MemoryGrid.tsx, SpatialSvg.tsx
│           ├── store/ui.ts            # zustand
│           └── i18n/                  # tr.ts, en.ts
│
└── scripts/
    ├── bots.ts                    # N sanal oyuncu ile yük/duman testi
    └── validate-content.ts        # içerik JSON doğrulaması
```

**Bağımlılık yönü kuralı:** `client → shared`, `server → shared`.
`shared` hiçbir şeye bağımlı değil (zod hariç), içinde DOM ve Node API'si yok.

---

## 3. Katman sorumlulukları (ihlal edilemez)

```
┌───────────── CLIENT ─────────────┐        ┌───────────── SERVER ─────────────┐
│ Ekran/animasyon/ses              │        │ GameRoom (Colyseus yaşam döngüsü)│
│ Girdi (dokunuş/klavye)           │  WS    │  └─ MatchController (faz makinesi)│
│ Sunucu state'ini GÖSTERME        │◄──────►│      ├─ PuzzleRegistry            │
│ Görsel sayaç (sunucu saatinden)  │        │      ├─ ScoreCalculator (shared)  │
│ Hiçbir rekabetçi karar YOK       │        │      └─ RoundState (cevaplar)     │
└──────────────────────────────────┘        └──────────────────────────────────┘
```

- **Client asla** doğruluğa, puana, faz geçişine, tur bitişine karar vermez.
- **GameRoom** puzzle içeriğini bilmez; `PuzzleRegistry`'den alır, `validate()` çağırır.
- **MatchController** Colyseus'u import etmez → birim testi kolay, motor değişirse taşınabilir.
- **Puzzle renderer'ları** ağ katmanını bilmez; `ClientPuzzle` alır, `onAnswer(choiceId)` çağırır.

---

## 4. Oda yaşam döngüsü ve oda kodu

### 4.1 Oda kurma / katılma

```
CREATE:  client.create("game", { nickname, roomCode: <clientta üretilmez!> })
         → sunucu onCreate'te kodu üretir, this.setPrivate(), metadata.roomCode = kod
JOIN:    client.join("game", { nickname, roomCode })   // filterBy(['roomCode'])
```

- Oda tipi: `defineRoom(GameRoom).filterBy(['roomCode'])`
- Oda **listelenmez** (`setPrivate()`), yani kimse rastgele odaları göremez.
- Kod sunucuda üretilir (client'a asla güvenilmez), 32 harfli alfabe, 5 karakter,
  aktif kodlara karşı çakışma kontrolü (en fazla 5 deneme, sonra 6 karaktere çık).
- Client tarafında girilen kod otomatik büyütülür, `I→1`, `O→0` gibi yaygın yazım
  hataları için normalizasyon **yapılmaz** (alfabe zaten bu harfleri içermiyor;
  bunun yerine geçersiz karakter reddedilir).

### 4.2 Davet linki ve QR

- Lobide: `https://<domain>/?r=Q7K8A`
- `navigator.share()` varsa **PAYLAŞ**, yoksa **KOPYALA**.
- Aynı odadaki telefonlar için lobide QR kod (küçük bir QR kütüphanesi, ~5 KB).
- Client açılışta `?r=` parametresini okur → takma ad ekranında kod alanını doldurur.

### 4.3 Kilitleme

Maç başlayınca `this.lock()` → yeni oyuncu giremez. `REMATCH` ile lobiye dönünce
`this.unlock()`. (İzleyici/geç katılım MVP'de yok.)

---

## 5. Puzzle sistemi (genişletilebilirliğin kalbi)

### 5.1 Sunucu tarafı arayüz

```ts
// shared/src/puzzle.ts
export type PuzzleType = 'PATTERN' | 'LOGIC' | 'MEMORY' | 'SPATIAL' | 'ODD_ONE_OUT' | 'REACTION' | 'WORD';

export interface ClientPuzzle {          // tarayıcıya giden — doğru cevap YOK
  id: string;
  type: PuzzleType;
  prompt: string;                        // i18n anahtarı veya düz metin
  data: unknown;                         // tipe özel (ızgara, svg parametreleri...)
  choices: { id: string; label: string }[];   // sıra oyuncuya göre karışık
  limitMs: number;
}

export interface ServerPuzzle {
  id: string;
  type: PuzzleType;
  difficulty: 1 | 2 | 3;
  prompt: string;
  data: unknown;
  choices: { id: string; label: string }[];
  correctChoiceId: string;               // ASLA client'a gitmez
  explanation?: string;                  // tur sonucunda gönderilir
  limitMs: number;
}
```

```ts
// server/src/puzzles/PuzzleGenerator.ts
export interface PuzzleGenerator {
  type: PuzzleType;
  generate(rng: Rng, difficulty: 1 | 2 | 3): ServerPuzzle;
}
```

Yeni bir puzzle tipi eklemek = **3 dosyaya dokunmak**:
1. `server/src/puzzles/<tip>.ts` (generator)
2. `server/src/puzzles/registry.ts` (bir satır kayıt)
3. `client/src/puzzles/registry.tsx` (bir satır renderer kaydı)

`GameRoom`, `MatchController`, protokol, puanlama **hiç değişmez**. Bu kural
mimarinin başarı testidir.

### 5.2 `toClientPuzzle(serverPuzzle, playerId)`

- `correctChoiceId` ve `explanation` çıkarılır.
- Şıklar oyuncuya özel permütasyonla karıştırılır; permütasyon `RoundState` içinde
  `Map<playerId, string[]>` olarak saklanır (cevap geldiğinde `choiceId` zaten
  kalıcı id olduğu için ekstra çözümlemeye gerek yok — bu yüzden index değil **id**
  gönderiyoruz).

### 5.3 Tohumlu üretim

```ts
matchSeed = rastgele 32-bit (maç başında bir kez, loglanır)
roundSeed = hash(matchSeed, roundIndex)
```

Aynı `matchSeed` → aynı sorular. Bug ayıklamada ve testte belirleyicilik sağlar.
Tekrarı önlemek için maç boyunca üretilen `puzzle.id`'ler bir `Set`'te tutulur;
çakışırsa yeniden üretilir (max 10 deneme).

---

## 6. Sunucu state modeli (Colyseus Schema)

```
GameState
├── phase: string                 // LOBBY | COUNTDOWN | REVEAL | PLAYING | LOCKED | ROUND_RESULT | GAME_RESULT
├── phaseEndsAt: number           // sunucu epoch ms — client sayacı bundan hesaplar
├── roomCode: string
├── hostId: string
├── round: number                 // 1..N
├── totalRounds: number
├── answeredCount: number         // kaç kişi cevapladı (kim/ne olduğu YOK)
├── players: MapSchema<PlayerSchema>
│     ├── id, nickname, connected, ready
│     ├── score, correctCount, streak
│     ├── hasAnswered            // bu tur cevapladı mı (doğruluk YOK)
│     └── joinIndex
└── lastRound: RoundResultSchema  // tur sonucu fazında dolu
```

**Kritik kural:** State'e giren her alan **tüm oyunculara** görünür. Doğru cevap,
kimin ne seçtiği, çeldirici bilgisi state'e **konmaz**; tur sonunda `round:result`
mesajıyla gönderilir. (Colyseus 0.16+ `StateView` ile oyuncuya özel filtreleme de
mümkün ama MVP'de "hassas veriyi state'e hiç koyma" yaklaşımı daha güvenli.)

Aktif turun cevapları, permütasyonlar ve `ServerPuzzle` → **state dışında**, normal
TypeScript nesnesinde (`MatchController` içinde) tutulur.

---

## 7. Zaman senkronizasyonu (ADALETİN TEMELİ)

### 7.1 Saat offset'i (bağlantıda ve her 30 sn'de bir)

```
client → "ping" { t0: clientNow }
server → "pong" { t0, tServer: serverNow }
client:  rtt    = clientNow2 - t0
         offset = tServer + rtt/2 - clientNow2
```
5 örnek alınır, **en küçük RTT'li örneğin** offset'i kullanılır (jitter'a dayanıklı).
`serverNow() = Date.now() + offset`.

### 7.2 Eşzamanlı açılış

Sunucu turu başlatırken `revealAt = serverNow + REVEAL_DELAY_MS (600ms)` hesaplar ve
puzzle'ı **hemen** gönderir. Client puzzle'ı alır ama `serverNow() >= revealAt`
olana kadar **göstermez** (blur/kapalı kart). Sonuç: 20 ms'lik ve 200 ms'lik
bağlantılar soruyu ±birkaç ms farkla görür.

### 7.3 Cevap süresi (gecikme telafisi)

```
serverMeasured = receivedAt - revealAt
clientClaimed  = clientAnswerAtServerTime - revealAt   // client'ın kendi ölçümü
halfRtt        = client.rttEstimate / 2                // sunucu son ping'lerden bilir

answerMs = clamp(clientClaimed,
                 serverMeasured - halfRtt - TOLERANCE_MS(80),
                 serverMeasured)
```

Yani: client'ın iddiası **kabul edilir ama sınırlandırılır**. Dürüst oyuncu
gecikmesinden dolayı ceza almaz; hilekâr "0 ms'de cevapladım" diyemez, çünkü alt
sınır sunucunun ölçtüğü süreden RTT/2 + 80 ms'ten fazla düşemez.

Ayrıca `answerMs < 0` veya `> limitMs` ise cevap reddedilir (`E_TIMING`).

### 7.4 Client sayacı

- `setInterval` ile **sayaç eksiltilmez** (arka plan sekmesinde donar → kayar).
- Her `requestAnimationFrame`'de `remaining = phaseEndsAt - serverNow()` yeniden hesaplanır.
- `visibilitychange` ile sekmeye dönüldüğünde otomatik doğru değere oturur.

---

## 8. Bağlantı kopması, host devri, oda ömrü

| Senaryo | Davranış |
|---|---|
| Oyuncu bağlantısı koparsa | `onDrop()` → `player.connected = false`, `allowReconnection(client, 45)` |
| 45 sn içinde dönerse | `onReconnect()` → aynı `sessionId`, skor korunur, mevcut faza girer |
| 45 sn'de dönmezse | Lobide: oyuncu silinir. Maç ortasında: "ayrıldı" olarak listede kalır, skoru tabloda durur, cevaplaması beklenmez |
| Host düşerse | En düşük `joinIndex`'e sahip **bağlı** oyuncu host olur (`hostId` güncellenir) |
| Maçta 1 kişi kalırsa | Maç 10 sn içinde sonlanır → `GAME_RESULT` ("rakipler ayrıldı") |
| Oda boş kalırsa | `autoDispose = false`; 120 sn timer ile odaya kimse dönmezse dispose |
| Sunucu yeniden başlarsa | Odalar kaybolur; client "oda bulunamadı" gösterir ve ana ekrana döner (MVP'de kabul) |

Client tarafı: `sessionStorage`'a `{roomId, sessionId}` yazılır → sayfa yenilense
bile `client.reconnect()` denenir. Bu, mobilde **çok sık** olan "yanlışlıkla
pull-to-refresh" durumunu kurtarır.

---

## 9. Güvenlik ve hile önleme

| Tehdit | Önlem |
|---|---|
| Doğru cevabı ağdan okuma | `correctChoiceId` **hiçbir zaman** açılmadan gönderilmez; tur sonunda gönderilir |
| Sahte skor gönderme | Client skor göndermez; protokolde böyle bir mesaj yok |
| "0 ms'de cevapladım" | §7.3'teki clamp |
| Aynı turda çoklu cevap | İlk cevap kabul, sonrakiler sessizce yok sayılır |
| Tur açılmadan cevap | `revealAt`'tan önce gelen cevap `E_TIMING` ile reddedilir |
| Mesaj bombardımanı | Client başına 20 mesaj/sn üstü → uyarı, 50/sn üstü → bağlantı kapatılır |
| Bozuk/kötü niyetli payload | Her mesaj zod ile doğrulanır; şema dışı = yok sayılır + log |
| Takma ad istismarı | Trim, 1–14 karakter, kontrol karakterleri ve zero-width temizlenir, HTML kaçışı React'te otomatik; boşsa "Oyuncu-N" |
| Oda kodu kaba kuvvet | IP başına 10 başarısız katılım/dk → 60 sn blok |
| Oda spam'i | IP başına dakikada 5 oda kurma |
| Yabancı origin'den bağlanma | WS origin kontrolü (izinli domain listesi) |
| Aynı masada kopya | Oyuncuya özel şık sıralaması |

**Tehdit modeli sınırı:** Bu bir arkadaş oyunu; hedef "kararlı bir hilekârı
imkânsız kılmak" değil, **kazara ve kolay hileyi kapatmak**. Para/sıralama devreye
girerse model yeniden yazılır.

---

## 10. Mobil tarayıcı kontrol listesi (baştan uygulanacak)

1. `height: 100dvh` kullan, `100vh` kullanma (iOS adres çubuğu).
2. `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
3. `env(safe-area-inset-*)` ile çentik/alt çubuk payı.
4. `touch-action: manipulation` (çift dokunuş zoom'unu kapatır, 300 ms gecikmeyi siler).
5. `overscroll-behavior: none` (oyun ortasında pull-to-refresh yenilemesini engeller).
6. `user-select: none` oyun alanında (uzun basınca metin seçilmesin).
7. Input `font-size: 16px` (iOS otomatik zoom yapmasın).
8. Ses: ilk kullanıcı dokunuşunda `AudioContext.resume()` (autoplay politikası).
9. `navigator.wakeLock` ile maç sırasında ekran uykusunu engelle (destekleyen tarayıcıda).
10. `navigator.vibrate(10)` cevap dokunuşunda (destekleyen cihazda).
11. Arka plana atılan sekmede timer donar → sayaç **her zaman** `serverNow()`'dan hesaplanır (§7.4).
12. `visibilitychange` + `online/offline` olaylarında bağlantı durumu kontrol edilir, gerekirse reconnect.

---

## 11. Performans hedefleri

- Prod JS bundle < **250 KB gzip** (React+Vite+Tailwind+colyseus.js buna rahat sığar).
- İlk anlamlı boyama < 1.5 sn (mobil 4G).
- Sunucu: bir tur işlemi < 20 ms; 200 eşzamanlı oda tek 1 vCPU'da.
- State güncellemesi tur başına birkaç kez (sürekli tick yok) → bant genişliği ihmal edilebilir.

---

## 12. Mimari kararlar günlüğü (ADR)

Önemli her karar `docs/DECISIONS.md`'ye şu formatta yazılır:

```md
## ADR-00X: <başlık>
- Tarih:
- Bağlam: (hangi problem)
- Karar:
- Alternatifler ve neden elendi:
- Sonuçları / geri dönüş maliyeti:
```

İlk üç ADR hazır kabul edilir: **ADR-001** Phaser yerine DOM/React,
**ADR-002** Colyseus 0.17, **ADR-003** hassas veri state'e konmaz (mesajla gönderilir).
