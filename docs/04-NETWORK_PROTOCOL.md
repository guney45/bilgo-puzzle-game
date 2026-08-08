# 04 — Ağ Protokolü (Sözleşme)

Bu dosya client ve server arasındaki **tek sözleşmedir**. Tipler
`packages/shared/src/messages.ts` içinde bire bir bu şekilde tanımlanır ve
`schemas.ts` içinde zod karşılıkları bulunur. Protokol değişirse **önce burası**
güncellenir.

Taşıma: Colyseus mesajları (MsgPack). İki kanal var:
1. **State senkronu** (otomatik, `GameState` — bkz. `03-ARCHITECTURE.md` §6)
2. **Mesajlar** (aşağıdaki tablolar) — anlık olaylar ve hassas veri için

---

## 1. Client → Server

| Tip | Payload | Ne zaman | Sunucu doğrulaması |
|---|---|---|---|
| `player:setNickname` | `{ nickname: string }` | Odaya girişte (join options ile de gelir) | 1–14 karakter, sanitize |
| `player:ready` | `{ ready: boolean }` | Lobide | Faz `LOBBY` olmalı |
| `match:start` | `{}` | Host başlatınca | Gönderen host mu, ≥2 bağlı oyuncu var mı, faz `LOBBY` mi |
| `round:answer` | `{ puzzleId, choiceId, clientAnsweredAtServerMs }` | Puzzle fazında | Faz `PLAYING`, `puzzleId` güncel, ilk cevap, zamanlama makul |
| `match:rematch` | `{}` | Final ekranında | Faz `GAME_RESULT` |
| `net:ping` | `{ t0: number }` | Bağlantıda ×5, sonra 30 sn'de bir | — |
| `player:reaction` | `{ emoji: string }` | (Faz 11) tur sonucunda | Beyaz listedeki 6 emoji, 1 sn'de 1 |

```ts
export type ClientMessage =
  | { type: 'player:setNickname'; nickname: string }
  | { type: 'player:ready'; ready: boolean }
  | { type: 'match:start' }
  | { type: 'round:answer'; puzzleId: string; choiceId: string; clientAnsweredAtServerMs: number }
  | { type: 'match:rematch' }
  | { type: 'net:ping'; t0: number };
```

## 2. Server → Client

| Tip | Payload | Ne zaman |
|---|---|---|
| `net:pong` | `{ t0: number; tServer: number }` | `net:ping` cevabı |
| `room:welcome` | `{ roomCode, youId, hostId, config: PublicConfig }` | Katılım sonrası bir kez |
| `round:puzzle` | `{ puzzle: ClientPuzzle; round: number; totalRounds: number; revealAt: number; endsAt: number }` | Tur başlarken (REVEAL) |
| `round:answerAck` | `{ puzzleId: string; accepted: boolean; code?: ErrorCode }` | Cevap alındığında (**doğruluk bilgisi yok**) |
| `round:result` | `RoundResult` | Tur kilitlenince |
| `match:result` | `MatchResult` | Son turdan sonra |
| `room:notice` | `{ code: NoticeCode; playerId?: string; nickname?: string }` | Oyuncu girdi/çıktı, host değişti, oyuncu döndü |
| `error` | `{ code: ErrorCode; message: string }` | Reddedilen işlem |

```ts
export interface RoundResult {
  round: number;
  puzzleId: string;
  correctChoiceId: string;        // ARTIK güvenli: tur bitti
  explanation?: string;
  entries: Array<{
    playerId: string;
    choiceId: string | null;      // null = cevaplamadı
    correct: boolean;
    answerMs: number | null;
    gained: number;               // bu turda kazanılan puan
    total: number;                // güncel toplam
    bonuses: Array<'FIRST_CORRECT' | 'STREAK_3' | 'STREAK_5' | 'FINAL_X2'>;
  }>;
  standings: Array<{ playerId: string; rank: number; total: number }>;
}

export interface MatchResult {
  standings: Array<{ playerId: string; rank: number; total: number; correctCount: number }>;
  stats: {
    fastestCorrect?: { playerId: string; answerMs: number; round: number };
    mostCorrect?: { playerId: string; count: number };
    longestStreak?: { playerId: string; streak: number };
  };
  matchSeed: number;              // hata bildirimi için
}
```

## 3. Hata ve bildirim kodları

```ts
export type ErrorCode =
  | 'E_ROOM_NOT_FOUND'    // kod yanlış veya oda kapandı
  | 'E_ROOM_FULL'
  | 'E_MATCH_STARTED'     // maç başladı, katılım kapalı
  | 'E_NOT_HOST'
  | 'E_NOT_ENOUGH_PLAYERS'
  | 'E_WRONG_PHASE'
  | 'E_ALREADY_ANSWERED'
  | 'E_STALE_PUZZLE'      // eski turun cevabı
  | 'E_TIMING'            // süre dışı / imkânsız zaman
  | 'E_INVALID_NICKNAME'
  | 'E_RATE_LIMITED'
  | 'E_INVALID_PAYLOAD';

export type NoticeCode =
  | 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED' | 'HOST_CHANGED' | 'MATCH_ABORTED';
```

Her `ErrorCode` için client'ta **Türkçe kullanıcı mesajı** vardır
(`i18n/tr.ts` → `errors.E_ROOM_NOT_FOUND = "Böyle bir oda bulunamadı."`).
Ham kod kullanıcıya asla gösterilmez.

---

## 4. Akış diyagramları

### 4.1 Oda kurma ve katılma

```
A: create("game", {nickname:"Furkan"})
        └─ server: kod üret (Q7K8A), setPrivate(), metadata.roomCode
        └─ server → A: room:welcome {roomCode:"Q7K8A", youId, hostId=A}
        └─ state: players{A}

B: join("game", {nickname:"Mehmet", roomCode:"Q7K8A"})
        └─ (kod yoksa) → E_ROOM_NOT_FOUND
        └─ (kilitliyse) → E_MATCH_STARTED
        └─ server → B: room:welcome
        └─ state: players{A,B}  → herkese otomatik senkron
```

### 4.2 Bir turun tam akışı

```
  server                                   client A            client B
    │ phase=REVEAL, revealAt=T+600         │                   │
    ├─ round:puzzle (ClientPuzzle) ───────►│                   │
    ├─ round:puzzle (farklı şık sırası) ───┼──────────────────►│
    │                                      │ (T+600'de göster) │ (T+600'de göster)
    │ phase=PLAYING, phaseEndsAt=T+600+limit                   │
    │◄──── round:answer {choiceId, clientAt} ──────────────────┤ (2.1 sn)
    ├─ round:answerAck {accepted:true} ────────────────────────►│
    │  state.answeredCount=1                                    │
    │◄──── round:answer ───────────────────┤ (3.4 sn)          │
    ├─ round:answerAck ───────────────────►│                   │
    │  hepsi cevapladı → 600 ms sonra LOCKED                    │
    │ puanla (shared/scoring.ts)                                │
    │ phase=ROUND_RESULT, phaseEndsAt=now+4000                  │
    ├─ round:result (correctChoiceId dahil) ──────────────────► her ikisi
    │ 4 sn sonra → sonraki tur veya match:result                │
```

### 4.3 Yeniden bağlanma

```
B'nin ağı gider
  server: onDrop → player.connected=false → allowReconnection(client, 45)
  A: state güncellenir → listede "bağlantı yok" ikonu; maç DURMAZ
B geri gelir (sessionStorage'daki roomId+sessionId ile client.reconnect())
  server: onReconnect → connected=true → room:notice PLAYER_RECONNECTED
  B: state'i baştan alır → phase ve phaseEndsAt'a göre doğru ekranı açar
  (kaçırdığı turun cevabı yok sayılır, o turdan 0 puan alır)
```

---

## 5. Protokol kuralları (ajan için)

1. Client'tan gelen hiçbir alan doğrudan state'e yazılmaz; önce zod + iş kuralı.
2. Bir mesaj reddedildiğinde **sessizce yutulmaz**: `error` gönderilir ve loglanır.
3. `round:puzzle` her oyuncuya **ayrı ayrı** gönderilir (şık sırası kişiye özel) — broadcast değil.
4. `round:result`'tan önce hiçbir mesajda doğruluk bilgisi olmaz (`answerAck` dahil).
5. Yeni bir mesaj tipi eklerken: `messages.ts` + `schemas.ts` + bu dosya birlikte güncellenir.
6. Sunucu zamanı her yerde `Date.now()` (epoch ms, UTC). Client `serverNow()` kullanır.
