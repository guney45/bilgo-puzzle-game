# 02 — Oyun Tasarımı (GDD)

Bu dosya "oyun ne yapıyor" sorusunun tek doğru kaynağıdır. Buradaki tüm sayılar
koda **sabit (constant) olarak** girer, dağıtılmış halde değil: `shared/src/config.ts`.

---

## 1. Maç yapısı

```
LOBBY → COUNTDOWN(3sn) → [ REVEAL → PLAYING → LOCKED → ROUND_RESULT ] × N → GAME_RESULT → (REMATCH → LOBBY)
```

| Faz | Süre | Ne olur |
|---|---|---|
| `LOBBY` | sınırsız | Oyuncular girer, hazır olur, host başlatır |
| `COUNTDOWN` | 3000 ms | 3-2-1 animasyonu, herkes aynı anda |
| `REVEAL` | 600 ms | Soru gönderildi ama **görünmüyor**; tüm client'lar aynı sunucu zamanında açar |
| `PLAYING` | tipe göre 10–25 sn | Cevap kabul edilir |
| `LOCKED` | 600 ms | Herkes cevapladı veya süre doldu; "kilitlendi" animasyonu |
| `ROUND_RESULT` | 4000 ms | Doğru cevap, kim ne sürede bildi, güncel sıralama |
| `GAME_RESULT` | sınırsız | Podyum + istatistikler + TEKRAR OYNA |

**Tur erken biter:** Bağlı ve aktif tüm oyuncular cevapladıysa `PLAYING` derhal
biter (`LOCKED`'a geçer). Bu kural tempo için kritik.

**Tur sayısı:** MVP `ROUNDS_PER_MATCH = 5`, kararlı olunca `= 10`.

---

## 2. Zorluk eğrisi

Tur numarasına göre zorluk (1=kolay, 3=zor):

| Tur (5 turluk maçta) | Zorluk | Süre çarpanı |
|---|---|---|
| 1 | 1 | 1.0 |
| 2 | 1 | 1.0 |
| 3 | 2 | 1.1 |
| 4 | 2 | 1.1 |
| 5 (final) | 3 | 1.25 |

10 turluk maçta: 1-3 → zorluk 1, 4-7 → 2, 8-10 → 3.
Formül `shared/src/config.ts` içinde `difficultyForRound(round, totalRounds)`.

**Tip dağılımı:** Bir maçta aynı puzzle tipi arka arkaya iki kez gelmez ve toplam
tur sayısının yarısından fazlasını bir tip kaplayamaz. Seçim `matchSeed` ile
tohumlanmış RNG üzerinden yapılır (maç tekrar üretilebilir olsun).

---

## 3. Puzzle tipleri

Her tip için: MVP'de mi, girdi biçimi, süre, üretim yöntemi.

### 3.1 `PATTERN` — Sayı/şekil örüntüsü  ✅ MVP

Prosedürel üretilir. Örnek: `2, 6, 18, 54, ?` → `162`.

| Zorluk | Kural ailesi |
|---|---|
| 1 | aritmetik (`+n`), geometrik (`×n`) |
| 2 | alternatif (`+a, ×b` dönüşümlü), kare/küp dizileri, Fibonacci benzeri |
| 3 | ikinci fark sabit, iki dizinin geçmeli birleşimi, `n² + n` gibi bileşik |

- Girdi: 4 şık (çoktan seçmeli)
- Çeldiriciler: doğru cevabın ±%10–%40'ı, ve "bir önceki kuralı uygulayan" yanlış cevap (klasik tuzak)
- Süre: 15 sn (zorluk çarpanı ile 15/16.5/18.75)

### 3.2 `LOGIC` — Sözel mantık  ✅ MVP

JSON havuzdan gelir (`content/logic.tr.json`). Örnek:

> Ali, Mehmet'ten uzun. Mehmet, Can'dan uzun. Aşağıdakilerden hangisi **kesinlikle** doğrudur?
> A) Can en kısadır ✔ B) Ali ve Can eşittir C) Mehmet en uzundur D) Bilinemez

- MVP için gereken minimum havuz: **zorluk başına 40 soru = 120 soru** (yoksa aynı maçta tekrar riski)
- İlk 30'unu ajana ürettirebilirsin ama **elle kontrol et** — hatalı mantık sorusu güveni bitirir
- Süre: 20 sn

### 3.3 `MEMORY` — Görsel hafıza  ⏳ Faz 10

3×3 renkli/şekilli ızgara 3 sn gösterilir → kaybolur → "sol üstteki neydi?" veya
"hangi hücre değişti?".

- **Renk körü güvenliği zorunlu:** her renge farklı **şekil** eşlik eder (daire/kare/üçgen/yıldız...). Sadece renkle ayırt edilen tasarım yasak.
- Gösterim süresi de sunucu zamanlı olmalı (hile: DevTools'ta ızgarayı DOM'da tutmak → ızgara kaybolunca sunucu ikinci bir mesajla sorunun gövdesini gönderir, ilk mesajda ızgara vardır ve o zaten görünmüştür; kabul edilebilir risk, arkadaş oyunu)
- Süre: gösterim 3 sn + cevap 10 sn

### 3.4 `SPATIAL` — Uzamsal akıl yürütme  ⏳ Faz 10

Şekil döndürme, simetri, eksik parça. SVG ile prosedürel üretilir
(döndürme açısı ve şekil parametreleri tohumdan).

- Süre: 20 sn

### 3.5 `ODD_ONE_OUT` — Farklı olanı bul  ⏳ Faz 10

5 öğe, biri kategori dışı. Yarı prosedürel: kategori listelerinden (hayvan/meyve/ülke/
enstrüman...) 4 + 1 çekilir. `content/categories.tr.json`.

- Süre: 12 sn

### 3.6 `REACTION` — Hızlı gözlem  ⏳ Faz 11

"Ekranda kaç tane 🔴 var?" / "İki ızgara arasındaki fark hangisi?" Saf hız.
Tempo kırıcı olarak maç ortasına iyi gider.

- Süre: 10 sn

### 3.7 `WORD` — Kelime  ⏳ Faz 11 (opsiyonel)

Anagram, eksik harf, kelime türetme. Türkçe kelime listesi gerektirir
(TDK tabanlı açık liste). Senin eski "kelime puzzle" fikrinle buluşma noktası.

> **MVP kararı: sadece `PATTERN` + `LOGIC`.** Diğer beşi mimariye takılıp
> kalmadan sonradan eklenecek şekilde tasarlandı (bkz. `03-ARCHITECTURE.md` §5).

---

## 4. Cevap etkileşimi

- Tüm MVP puzzle'ları **4 şıklı çoktan seçmeli**. Neden: tek dokunuş, mobil klavye yok, doğrulama tartışmasız, süre ölçümü net.
- Şıklar ekranın **alt yarısında**, tam genişlik, minimum 56 px yükseklik (başparmak bölgesi).
- Bir dokunuş = kesin cevap (onay yok). Dokununca şık kilitlenir, "cevabın alındı" hissi verilir (haptic + renk).
- Cevap verildikten sonra: diğer şıklar soluklaşır, sayaç görünmeye devam eder, **doğru/yanlış gösterilmez** (tur sonuna kadar).
- Şık sırası **her oyuncu için farklıdır** (kopya önleme).

---

## 5. Puanlama

### 5.1 Temel formül

```ts
// shared/src/scoring.ts — SAF fonksiyon, yan etkisiz, birim testli
BASE_POINTS   = 500   // doğru cevap
SPEED_POINTS  = 500   // hız bonusu tavanı
GRACE_MS      = 500   // ilk yarım saniye tam bonus (refleks farkını yumuşatır)

function scoreAnswer({ correct, answerMs, limitMs, roundMultiplier }) {
  if (!correct) return 0;
  const t = clamp((answerMs - GRACE_MS) / (limitMs - GRACE_MS), 0, 1);
  const speed = Math.round(SPEED_POINTS * (1 - t));   // doğrusal azalma
  return Math.round((BASE_POINTS + speed) * roundMultiplier);
}
```

Örnek (limit 15 sn, çarpan 1):

| Cevap süresi | Puan |
|---|---|
| 0.5 sn | 1000 |
| 2 sn | 948 |
| 5 sn | 845 |
| 10 sn | 672 |
| 14.9 sn | 502 |
| yanlış / cevapsız | 0 |

### 5.2 Çarpanlar ve bonuslar (MVP'de açık)

| Kural | Değer | Gerekçe |
|---|---|---|
| `FINAL_ROUND_MULTIPLIER` | son turda 2× | Geride kalan maçtan kopmasın; final gerilimi |
| `STREAK_BONUS` | üst üste 3 doğru → +150, 5 doğru → +300 | Ustalığı ödüllendir |
| `FIRST_CORRECT_BONUS` | turun ilk doğru cevabına +100 | "Hızlıydım" hissi somutlaşsın |

Yanlış cevap **eksi puan getirmez** (MVP). Eksi puan, SAFE/RISK sistemi geldiğinde
(Faz 11) opsiyonel olur.

### 5.3 Beraberlik bozma (sırayla)

1. Toplam puan
2. Doğru cevap sayısı
3. Toplam cevap süresi (küçük olan önde)
4. En hızlı tek cevap
5. Odaya katılma sırası (deterministik olsun diye)

### 5.4 Genişletilebilirlik (kod kuralı)

`scoreAnswer` bir `modifier?: ScoreModifier` parametresi alacak şekilde yazılır:

```ts
type ScoreModifier = { kind: 'NONE' | 'SAFE' | 'RISK' | 'DOUBLE'; }
```

MVP'de her zaman `NONE` gönderilir. Böylece SAFE/RISK ve "Double" power-up'ı
puanlama dosyasında tek `switch`'e dönüşür; oda/ağ/UI kodu değişmez.

---

## 6. Süre sabitleri (tek yerden)

```ts
// shared/src/config.ts
COUNTDOWN_MS         = 3000
REVEAL_DELAY_MS      = 600    // "şu sunucu zamanında aç" tamponu
ALL_ANSWERED_GRACE_MS= 600
ROUND_RESULT_MS      = 4000
LOCKED_MS            = 600
ROUNDS_PER_MATCH     = 5      // sonra 10
MIN_PLAYERS          = 2
MAX_PLAYERS          = 8
NICKNAME_MAX         = 14
ROOM_CODE_LENGTH     = 5
ROOM_CODE_ALPHABET   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
RECONNECT_WINDOW_S   = 45
EMPTY_ROOM_DISPOSE_S = 120
PUZZLE_TIME_MS       = { PATTERN: 15000, LOGIC: 20000, MEMORY: 10000, SPATIAL: 20000, ODD_ONE_OUT: 12000, REACTION: 10000, WORD: 20000 }
```

---

## 7. Ekranlar ve mobil düzen

### 7.1 Ekran listesi

1. **Home** — takma ad + [ODA KUR] + kod alanı + [KATIL]
2. **Lobby** — oda kodu (büyük), QR, [LİNKİ KOPYALA]/[PAYLAŞ], oyuncu listesi, hazır düğmesi, host için [BAŞLAT]
3. **Countdown** — tam ekran 3-2-1
4. **Puzzle** — üstte tur/sayaç/mini skor, ortada soru, altta 4 şık
5. **RoundResult** — doğru cevap + oyuncu satırları (süre, +puan) + sıralama
6. **GameResult** — podyum, istatistikler, [TEKRAR OYNA]
7. **Overlay'ler** — bağlantı koptu / yeniden bağlanılıyor / oda bulunamadı / maç başlamış

### 7.2 Mobil düzen kuralları

- Dikey (portrait) birincil; yatayda aynı düzen, sadece şıklar 2×2 ızgara olur.
- Dokunma hedefi min **48×48 px**, şıklar min 56 px yükseklik.
- Kritik bilgi ekranın üst %15 ve alt %10'una konmaz (çentik/ana ekran çubuğu) → `env(safe-area-inset-*)`.
- Hover'a bağlı hiçbir bilgi yok.
- Yükseklik birimi `dvh`, asla `vh` değil (iOS Safari adres çubuğu).
- Font: min 16 px (iOS input zoom'unu engeller), soru metni 20–28 px arası akışkan (`clamp()`).

### 7.3 Görsel yön

Koyu tema, yüksek kontrast, tek vurgu rengi + doğru/yanlış için yeşil/kırmızı **+ ikon**
(renk körü). Animasyonlar 150–250 ms, `prefers-reduced-motion` desteklenir.
Ses: cevap, tur sonu, geri sayım, kazanma — kısa ve kapatılabilir; ilk dokunuşta unlock.

---

## 8. İçerik üretim planı

| Kaynak | Tip | Adet (MVP) |
|---|---|---|
| Prosedürel (kod) | PATTERN | sonsuz |
| JSON havuz | LOGIC | 120 (zorluk başına 40) |
| JSON havuz | ODD_ONE_OUT kategorileri | 30 kategori × 8 öğe |

- Dosya biçimi: `content/<tip>.<dil>.json`, şeması zod ile doğrulanır, **sunucu açılışında** doğrulanır (bozuk içerik = açılışta hata, maç ortasında değil).
- Her sorunun `id`'si sabittir (ileride "bu soru hatalı" raporu için).
- Dil: `tr` birincil, `en` yapı olarak hazır (`i18n` anahtarları + içerik dosyaları), çevirisi sonra.

---

## 9. Gelecek mekanikler (mimari yer ayrıldı, MVP'de yok)

- **SAFE / RISK:** cevapla birlikte gönderilen `modifier`. SAFE: normal. RISK: doğru 1.5×, yanlış −250. Tur başına bir kez.
- **Power-up'lar:** Freeze (rakibin şıkları 2 sn geç açılır), Shuffle (rakibin şık sırası değişir), Shield, Double, Peek (bir çeldirici elenir). Sunucu tarafında `RoundEffects` tablosu, cevap değerlendirmesi bunlardan bağımsız kalır.
- **Takım modu**, **maç geçmişi**, **kalıcı sıralama** — DB gerektirir, ayrı karar.
