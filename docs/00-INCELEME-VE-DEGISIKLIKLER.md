# 00 — İlk Brief'in İncelemesi: Hatalar, Eksikler, Değişiklikler

Bu dosya "ne değişti ve neden" sorusunun cevabı. Diğer dosyaları okumadan önce bunu oku.

**Genel değerlendirme:** ChatGPT'nin verdiği brief **iskelet olarak iyi**. Doğru yaptığı
üç kritik şey var: (1) sunucu otoritesi (server-authoritative), (2) MVP'yi küçük tutma,
(3) puzzle mantığını multiplayer mantığından ayırma. Bunlar korunuyor.

Ama belge büyük ölçüde **"ne yapılmalı" listesi**, "nasıl yapılacak" değil. İçinde
tek bir formül, tek bir tip tanımı, tek bir sayı yok — Claude Code'a verdiğinde her
kritik kararı ajan kendi kafasına göre verir ve sen sonuçtan memnun kalmazsın.
Ayrıca **bir tane ciddi teknoloji hatası** ve **oyunu kırabilecek 3 tasarım boşluğu** var.

---

## A. HATALAR (düzeltildi)

### A1. 🔴 Phaser yanlış seçim — kaldırıldı

Brief, client için **Phaser** öneriyor. Bu senin oyunun için yanlış araç.

Phaser bir **canvas oyun motoru**: her şeyi kendi çiziyor. Senin oyunun ise pratikte
şunlardan oluşuyor: nickname input'u, oda kodu ekranı, oyuncu listesi, soru metni,
4 tane büyük şık butonu, sayaç, skor tablosu. Yani **%90 arayüz, %10 oyun**.

Phaser ile gidersen bedeli:

| Sorun | Sonuç |
|---|---|
| Canvas'ta responsive metin/buton düzeni | Her ekran boyutu için elle konumlandırma cehennemi |
| Mobil klavye (nickname girişi) | Canvas'ta HTML input'u üstüne overlay etmek zorundasın — çirkin bug kaynağı |
| Erişilebilirlik, tarayıcı geri tuşu, kopyala-yapıştır (oda kodu!) | Bedava gelen her şeyi kaybediyorsun |
| Bundle boyutu | ~1 MB+ gereksiz yük; mobil 4G'de ilk açılış yavaş = friction, senin 1 numaralı düşmanın |
| Geliştirme hızı | CSS'te 5 dakikalık iş, canvas'ta 2 saat |

**Yerine:** React + TypeScript + Vite + Tailwind (DOM/CSS).
İleride "hafıza kartları", "şekil döndürme" gibi görsel puzzle'lar gelince
**o puzzle'ın içine** SVG veya `<canvas>` koyarsın. Yani canvas'ı tüm oyuna değil,
ihtiyacı olan tek bileşene ödersin. Mimari zaten bunu destekleyecek şekilde
tasarlandı (`PuzzleRenderer` arayüzü — bkz. `03-ARCHITECTURE.md`).

> Not: Unity deneyimin var ama bu proje için Unity de Phaser da gereksiz.
> Unity WebGL build'i mobil tarayıcıda 10–20 MB ve ilk açılış 5–15 saniye —
> "linke tıkla, hemen oyna" hedefini tek başına öldürür.

### A2. 🟠 Colyseus doğru ama sürüm bilgisi eksik — güncellendi

Colyseus seçimi doğru (oda yönetimi, state senkronu, reconnection, matchmaking hazır).
Ama brief hangi sürüm olduğunu söylemiyor; ajan büyük ihtimalle eğitim verisindeki
eski API'yi (`gameServer.define(...)`) yazar ve kod çalışmaz.

Güncel durum: **Colyseus 0.17** (Şubat 2026'da çıktı). Bu sürümde <cite index="4-1">otomatik yeniden bağlanma, uçtan uca TypeScript tip güvenliği ve birleşik `defineServer()` API'si</cite> geldi; <cite index="4-1">sunucu tarafında `onDrop()` ve `onReconnect()` yaşam döngüsü metotlarıyla yeniden bağlanma yönetimi</cite> yapılıyor.

Bunun bizim için pratik karşılıkları `03-ARCHITECTURE.md`'de yazılı:
- Oda kodu ile katılım: <cite index="10-1">`defineServer({ rooms: { battle: defineRoom(BattleRoom).filterBy(['password']) } })` ve odayı `this.setPrivate()` ile listelenmez yapmak</cite> — biz `password` yerine `roomCode` kullanacağız.
- Davet linki: <cite index="17-1">room ID'yi linkte paylaşıp karşı tarafta `client.joinById(...)` ile katılma</cite> deseni.

**Kural olarak eklendi:** Ajan Colyseus API'si yazmadan önce `docs.colyseus.io`'yu
kontrol etmeli, hafızasından yazmamalı.

### A3. 🟠 "Gecikme telafisi yapma" tavsiyesi bu oyunda yanlış

Brief §13: "MVP için latency compensation'ı overengineer etme."

Bu tavsiye **hareket bazlı** oyunlar için doğru, senin oyunun için **tehlikeli**.
Çünkü senin oyununda **puan doğrudan süreye bağlı**. Ev interneti 20 ms olan biriyle
mobil veride 180 ms olan biri yarışırsa, ikincisi her turda ~160 ms handikapla
başlıyor ve bu tur sonuçlarını değiştirmeye yeter. "Ben aynı anda bastım ama o kazandı"
= oyunun ölümü.

Çözüm karmaşık değil, ama **atlanamaz**:
1. Bağlantıda 5 örneklik bir saat senkronizasyonu (offset + RTT ölçümü),
2. Soruyu "şu sunucu zamanında göster" diyerek herkese aynı anda açtırma,
3. Cevap süresini hesaplarken tek yönlü gecikmeyi (RTT/2) düşme.

Detaylı algoritma: `03-ARCHITECTURE.md` → §7 "Zaman Senkronizasyonu".

### A4. 🟡 Oda kodu tasarımı yarım

Brief "0/O, 1/I/L karıştırmasın" diyor — doğru ama yetersiz. Eksikler:
- Alfabe tanımlanmamış → **tanımlandı**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 karakter, I/O/0/1 yok)
- Uzunluk gerekçesiz 6 → **5'e indirildi** (mobilde yazması kolay, 33 milyon kombinasyon, aynı anda 5000 oda olsa bile çakışma ihmal edilebilir)
- Küçük/büyük harf duyarlılığı belirtilmemiş → **duyarsız**, input otomatik büyütülür
- Çakışma kontrolü yok → **var** (üretimde aktif kodlara bakılır)
- Kaba kuvvet (brute force) koruması yok → **IP başına dakikada 10 başarısız katılım denemesi** limiti
- **En büyük eksik: link ile katılım yok.** Brief §2 "biri link gönderir" diyor ama tasarımda sadece kod yazma var. Eklendi: `https://oyun.com/?r=Q7K8A` linki + Web Share API + lobide **QR kod** (aynı odadaki telefonlar için en hızlı yol).

---

## B. EKSİKLER (eklendi)

### B1. 🔴 Turun erken bitmesi yok

Brief'te tur her zaman "10–20 saniye" sürüyor. 2 kişilik maçta ikisi de 4. saniyede
cevapladıysa, 12 saniye boş ekrana bakacaklar. Parti oyununda tempo her şeydir.

**Eklendi:** Bağlı tüm oyuncular cevapladığında tur 600 ms sonra kapanır.
Ayrıca "3/4 cevapladı" göstergesi (kimin doğru yaptığı **gösterilmez**, sadece sayı) —
bu hem tempo verir hem baskı yaratır.

### B2. 🔴 Puanlama formülü yok

Brief "100 baz + 0–100 hız bonusu" diyor, formül yok. Ayrıca **beraberlik kuralı yok**,
**geri dönüş mekaniği yok**.

**Eklendi** (`02-GAME_DESIGN.md` §5): kesin formül, eşitlik bozma sırası, ve
parti oyunları için kritik olan **son tur 2× puan** kuralı. Bu kural olmadan
3. turda geride kalan oyuncu maçtan kopar ve tekrar oynamak istemez.

### B3. 🔴 Soru havuzu / içerik stratejisi yok

Brief puzzle *tiplerini* sayıyor ama şunları hiç konuşmuyor:
- Sorular nereden gelecek? (elle yazılmış havuz mu, prosedürel üretim mi)
- Aynı soru aynı maçta tekrar gelmesin diye ne yapılacak?
- Zorluk turlarla artacak mı?
- **Dil ne olacak?** (Sen ve arkadaşların Türkçe oynayacaksınız; brief tamamen İngilizce örnekler veriyor)

**Eklendi:** Hibrit içerik modeli — matematik/örüntü/hafıza/uzamsal puzzle'lar
**tohumlu (seeded) prosedürel üretim** ile sonsuz üretilir; mantık/kelime soruları
JSON havuzdan gelir. Maç başına tek bir `matchSeed` → maçlar tekrar üretilebilir
(bug ayıklamak için altın değerinde). Türkçe/İngilizce i18n ilk günden.

### B4. 🟠 Şık sırası herkeste aynı → aynı odadaki arkadaşlar kopya çeker

Aynı masada oturan 4 kişi oynarken biri "üçüncü şık!" diye bağırırsa oyun biter.

**Eklendi:** Şıklar **her oyuncuya farklı sırada** gösterilir (sunucu her oyuncu için
permütasyonu saklar, cevabı çözerken geri çevirir). Bedava gelen bonus: gelecekteki
"Shuffle" power-up'ı bu altyapıyla 10 satırlık iş olur.

### B5. 🟠 Mobil tarayıcı tuzakları hiç yok

Brief "responsive olsun" diyor ama mobil web'in gerçek sorunlarına değinmiyor:
iOS Safari'de `100vh` hatası, arka plana atılan sekmede `setInterval`'in dondurulması
(→ sayaçlar kayar!), ses autoplay engeli, çift dokunuşla zoom, pull-to-refresh ile
oyunun ortasında sayfa yenilenmesi, ekranın uyuması, safe-area (çentik) alanları.

**Eklendi:** `03-ARCHITECTURE.md` §10'da 12 maddelik somut kontrol listesi + çözümleri.
Bunlar sonradan "düzeltilecek" şeyler değil, baştan doğru yapılacak şeyler.

### B6. 🟠 Güvenlik yüzeyi eksik

Brief sadece "correctAnswer'ı client'a gönderme" diyor. Eksikler: mesaj doğrulama
(zod), mesaj hız limiti, nickname sanitizasyonu ve uzunluk sınırı, oda kodu kaba
kuvvet limiti, WebSocket origin kontrolü, tur açılmadan gelen cevabın reddi,
aynı turda ikinci cevabın yok sayılması. Hepsi eklendi (`03-ARCHITECTURE.md` §9).

### B7. 🟠 Test stratejisi ve "iki cihaz" problemi yok

"İki cihazda aç ve dene" manuel test, her değişiklikte 5 dakika. **Eklendi:**
`@colyseus/testing` ile 2–4 sanal client'ın tam maç oynadığı entegrasyon testi +
saf fonksiyon testleri (puanlama, üreticiler, state machine) + N bot ile yük testi
scripti. Ajan her fazın sonunda bunları çalıştıracak.

### B8. 🟡 Deploy'da kritik tuzak yazılmamış

Brief "frontend statik host, backend WebSocket destekli" diyor ama **en sık yapılan
hatayı** söylemiyor: Vercel/Netlify **serverless fonksiyonları kalıcı WebSocket
tutamaz**. Colyseus sunucusu **kalıcı bir process** ister → Fly.io / Railway /
Render / Hetzner VPS / Colyseus Cloud. Ayrıca `wss://` (TLS) zorunlu, çünkü
`https` sayfadan `ws://` bağlantısı tarayıcı tarafından bloklanır.

### B9. 🟡 Boş oda / host kaçtı / herkes düştü senaryoları yarım

Brief host devri diyor, ama şunlar tanımsız: son oyuncu da çıkarsa oda ne kadar
yaşar? Maç ortasında 1 kişi kaldıysa ne olur? Maç bitmeden herkes düşerse?
Yeniden bağlanma penceresi kaç saniye? **Hepsi tablolaştırıldı** (`03-ARCHITECTURE.md` §8).

### B10. 🟡 Yol haritası var ama "kabul kriteri" ölçülebilir değil

Brief'in fazları makul, ama ajanla çalışırken işe yaramaz çünkü "bitti" tanımı
muğlak. **Yeniden yazıldı:** 12 faz, her fazda (a) dosya listesi, (b) somut kabul
kriteri, (c) **kopyala-yapıştır Claude Code promptu**, (d) commit mesajı.

---

## C. KORUNAN İYİ KARARLAR

Bunlara dokunmadım, doğrular:

1. **Sunucu otoritesi** — pazarlık konusu değil, tüm mimari bunun üstüne kuruldu.
2. **MVP'de hesap/DB/chat/mağaza yok** — doğru; hafızada state yeterli.
3. **Puzzle mantığı ↔ ağ mantığı ayrımı** — mimarinin belkemiği.
4. **Shared TypeScript paketi** — genişletildi (tipler + sabitler + saf puanlama fonksiyonları + zod şemaları).
5. **Faz faz ilerle, tek seferde tüm oyunu yazma** — ajanla çalışmanın tek doğru yolu.
6. **SAFE/RISK ve power-up'ları MVP'ye koyma ama mimariyi tıkama** — korundu, `ScoreCalculator`'a `modifier` parametresi olarak yer ayrıldı.

---

## D. ÖNERİLEN EKLER (kapsam kararı senin)

Bunlar brief'te hiç yoktu; bence oyunu belirgin şekilde iyileştirirler. Hepsi
yol haritasında **MVP sonrası** fazlara kondu, MVP'yi geciktirmezler:

| Öneri | Neden | Faz |
|---|---|---|
| **Tekrar oyna aynı odada + kalıcı oda linki** | Friction'ı sıfıra indirir | 9 |
| **Bot doldurma (tek kişi test/pratik)** | Arkadaş beklemeden test edebilirsin; ajan da test edebilir | 8 |
| **Emoji tepki butonları (tur sonu)** | Chat'siz sosyal his; 20 satırlık iş, geri dönüşü büyük | 11 |
| **"Son tur 2×" ve "seri (streak) bonusu"** | Maçın sonuna kadar gerilim | 5 (MVP içinde, sabit olarak) |
| **PWA manifest (ana ekrana ekle)** | Uygulama hissi, mağaza gerekmez | 12 |
| **Renk körü güvenli palet + şekil/etiket** | Hafıza puzzle'ı sadece renkle çalışırsa oyuncuların ~%8'i dezavantajlı | 2 (baştan) |
| **Basit anonim metrik (maç sayısı, ortalama süre)** | Hangi puzzle tipi eğlenceli, hangisi sıkıcı — veriyle karar ver | 12 |

---

## E. Özet: brief neydi, ne oldu

| Konu | ChatGPT brief | Bu doküman seti |
|---|---|---|
| Client | Phaser (canvas) | React + Vite + Tailwind (DOM), puzzle içi opsiyonel canvas/SVG |
| Sunucu | Colyseus (sürüm yok) | Colyseus 0.17, `defineServer`/`filterBy`/`onDrop` desenleriyle |
| Zaman | "Overengineer etme" | Saat senkronu + eşzamanlı açılış + RTT/2 telafisi (algoritma yazılı) |
| Puanlama | "100 + 0–100" | Kesin formül, eşitlik bozma, son tur 2×, `ScoreCalculator` izole |
| İçerik | Tip listesi | Hibrit: tohumlu prosedürel üretim + JSON havuz, TR/EN i18n |
| Protokol | Örnek 1 JSON | Tam state şeması + 14 mesaj tipi + hata kodları |
| Test | Yok | Birim + entegrasyon (@colyseus/testing) + bot yük testi |
| Deploy | "Sonra düşünürüz" | Somut seçenekler, tuzaklar, maliyet, ortam değişkenleri |
| Yol haritası | 10 muğlak faz | 12 faz + ölçülebilir kabul kriteri + hazır promptlar |
