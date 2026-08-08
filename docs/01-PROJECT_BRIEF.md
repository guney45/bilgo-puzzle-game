# 01 — Proje Brief (v2)

**Kod adı:** `puzzle-race`
**Tür:** Tarayıcı tabanlı, gerçek zamanlı, rekabetçi multiplayer bilmece/zeka yarışı
**Platform:** Mobil tarayıcı öncelikli, masaüstü ve tablet tam destekli
**Hedef oyuncu sayısı:** 2–8 (MVP: 2–6)
**Maç süresi:** 3–5 dakika (5 tur), sonra 10 tur

---

## 1. Vizyon

> Biri WhatsApp'a bir link atar. Herkes tıklar. 15 saniye içinde 4 kişi aynı odada
> zeka sorularında yarışıyordur. Maç 4 dakika sürer, biri kazanır, "bir tane daha"
> denir.

Rakip referanslar: Kahoot (soru-yarış temposu), Skribbl.io (oda kodu + sıfır kurulum),
Jackbox (arkadaşlarla parti hissi), Brain Test / Lumosity (puzzle içeriği).
Bizim farkımız: **kurulumsuz + Türkçe içerik + rekabetçi zeka puzzle'ları + kısa maç.**

## 2. Ürün ilkeleri (karar verirken bunlara bak)

1. **Sürtünme sıfır.** Kurulum yok, hesap yok, tutorial yok. Linkten oyuna ≤ 15 saniye.
2. **Sunucu her zaman haklı.** Tarayıcıya hiçbir rekabetçi karar bırakılmaz.
3. **Tempo kutsaldır.** Hiçbir ekranda oyuncu 5 saniyeden fazla beklememeli.
4. **Adalet hissedilebilir olmalı.** İnternet hızı maçı belirlememeli.
5. **Küçük ama tam.** Yarım 10 özellik yerine, tam çalışan 3 özellik.
6. **Baştan mobil.** Masaüstü, mobilin büyütülmüş hali olur; tersi değil.

## 3. Oyuncu akışı (hedef deneyim)

```
Link / QR                → ?r=Q7K8A ile gelir, oda kodu otomatik dolu
Takma ad ekranı          → "Furkan" yaz, OYNA
Lobi                     → oyuncu listesi, hazır durumu, QR kod, davet linki kopyala
Host: BAŞLAT             → 3-2-1 geri sayım
Tur 1..N                 → soru + şıklar + sayaç → cevapla → "3/4 cevapladı"
Tur sonucu (4 sn)        → doğru cevap, kimin ne kadar sürede bildiği, güncel sıralama
...                      → N tur
Final tablosu            → 🥇🥈🥉 + istatistik ("en hızlı cevap: Mehmet 1.2 sn")
TEKRAR OYNA              → aynı odada lobiye dön, yeni sorular
```

## 4. MVP tanımı (bitmiş sayılma koşulu)

MVP, aşağıdaki senaryo **iki ayrı fiziksel cihazda, farklı ağlarda** (biri Wi-Fi,
biri mobil veri) sorunsuz çalıştığında tamamlanmış sayılır:

1. Cihaz A siteyi açar, "Furkan" yazar, ODA KUR'a basar, `Q7K8A` kodunu ve linki alır.
2. Cihaz B linke tıklar, "Mehmet" yazar, odaya girer.
3. İki cihaz da lobide birbirini görür; Furkan BAŞLAT'a basar.
4. Her iki cihazda **aynı soru ±150 ms içinde** belirir.
5. İkisi de cevaplar; sunucu doğruluk, süre ve puanı hesaplar.
6. Tur sonucu iki cihazda da aynı görünür.
7. 5 tur sonunda final tablosu aynıdır.
8. TEKRAR OYNA ile yeni maç başlar, skorlar sıfırlanır.
9. Maç sırasında Cihaz B'nin ağı 5 saniye kesilirse, geri geldiğinde **kaldığı yere**
   döner; Cihaz A bu sırada donmaz.
10. Tarayıcıda hiçbir yerden (DevTools dahil) doğru cevaba, soru açılmadan
    **erişilemez**.

## 5. Kapsam dışı (MVP'de KESİNLİKLE yok)

Hesap/giriş, veritabanı, global sıralama, arkadaş sistemi, chat (emoji tepki hariç,
o da faz 11), kozmetik/mağaza/ödeme, başarımlar, seviye ilerlemesi, mobil uygulama
sarmalayıcı (Capacitor/native), birden fazla oyun modu, takım modu, sesli sohbet,
reklam, moderasyon paneli.

Bunların hiçbiri yasak değil — **sırası gelmedi**. Mimari hiçbirini imkânsız
kılmayacak şekilde tasarlandı.

## 6. Kalite çıtası (MVP)

| Ölçüt | Hedef |
|---|---|
| İlk yükleme (mobil 4G, önbelleksiz) | < 2.5 sn, JS bundle < 250 KB gzip |
| Link → oyuna girme | < 15 sn (takma ad yazma dahil) |
| Soruların cihazlar arası açılma farkı | < 150 ms |
| Sunucu tur işlem gecikmesi | < 20 ms |
| Aynı anda oda kapasitesi (tek 1 vCPU sunucu) | ≥ 200 oda / ~800 oyuncu |
| Desteklenen tarayıcılar | iOS Safari 16+, Android Chrome 110+, masaüstü Chrome/Firefox/Safari/Edge güncel |
| Çökme sonrası | Sunucu yeniden başlarsa aktif maçlar kaybolur (kabul edilebilir) |

## 7. Riskler ve önlemleri

| Risk | Etki | Önlem |
|---|---|---|
| Gecikme farkı adaleti bozar | Oyun terk edilir | Saat senkronu + RTT telafisi (Arch §7) |
| İçerik hızla tükenir / ezberlenir | Tekrar oynanmaz | Prosedürel üretim + geniş havuz + tohum |
| Puzzle'lar sıkıcı çıkar | Ürün ölür | Faz 10'da 5 tip birden test, arkadaşlarla playtest, metrik |
| Aynı odadaki oyuncular kopya çeker | Rekabet biter | Oyuncuya özel şık karıştırma |
| Mobil tarayıcı tuhaflıkları | Bug seli | Baştan mobil kontrol listesi (Arch §10) |
| Ajan (Claude Code) kapsam kaçırır | Karmaşa | CLAUDE.md + faz faz çalışma + her fazda commit |

## 8. Başarı sinyali (MVP sonrası)

Teknik değil, insani ölçüt: **Bir grup arkadaşın, sen söylemeden, ikinci maçı
oynamak istemesi.** Bu olmuyorsa özellik eklemek işe yaramaz — puzzle kalitesine
ve tempoya dönülür.
