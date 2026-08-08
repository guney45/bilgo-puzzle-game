# Puzzle Race — Doküman Seti (v2)

Bu klasör, **tarayıcı tabanlı rekabetçi multiplayer puzzle oyunu** için hazırlanmış
tam planlama + teknik doküman setidir. ChatGPT'nin verdiği ilk brief incelendi,
hatalı/eksik noktalar düzeltildi ve uygulanabilir bir mühendislik planına çevrildi.

## Dosyalar

| Dosya | Ne işe yarar | Kime |
|---|---|---|
| `00-INCELEME-VE-DEGISIKLIKLER.md` | İlk brief'in eleştirisi: neyi neden değiştirdim, neler eksikti | **Sana** (önce bunu oku) |
| `01-PROJECT_BRIEF.md` | Düzeltilmiş ana brief: vizyon, kapsam, MVP tanımı, kapsam dışı | Sana + ajana |
| `02-GAME_DESIGN.md` | Oyun tasarımı: puzzle tipleri, tur akışı, puanlama formülleri, denge sabitleri | Sana + ajana |
| `03-ARCHITECTURE.md` | Teknik mimari: stack kararları, repo yapısı, modül sınırları, güvenlik, zaman senkronu | Ajana (repo kökü) |
| `04-NETWORK_PROTOCOL.md` | Ağ sözleşmesi: state şeması, mesaj tipleri, hata kodları, akış diyagramları | Ajana (repo kökü) |
| `05-ROADMAP.md` | Faz faz yol haritası + her faz için **kopyala-yapıştır Claude Code promptu** | Sana (çalışma kılavuzun) |
| `06-OPERATIONS.md` | Geliştirme ortamı, test stratejisi, CI, deploy, maliyet, izleme | Sana + ajana |
| `CLAUDE.md` | Repo köküne konacak ajan kuralları dosyası (kısa ve emredici) | Ajana |

## Nasıl kullanacaksın (özet)

1. Boş bir klasör aç: `mkdir puzzle-race && cd puzzle-race && git init`
2. Bu dosyaları `docs/` altına kopyala; `CLAUDE.md`'yi **repo köküne** koy.
3. `claude` komutuyla Claude Code'u başlat.
4. `05-ROADMAP.md` içindeki **Faz 0** promptunu kopyala-yapıştır.
5. Her fazın sonunda: test et → commit at → `/clear` yaz → sonraki faza geç.

Detaylı çalışma disiplini için `05-ROADMAP.md` → "Claude Code ile Çalışma Kuralları"
bölümüne bak.

## Tek cümlelik proje tanımı

> Link'e tıklayan 2–8 kişinin, hiçbir kurulum ve hesap olmadan aynı odada
> buluşup 5–10 turluk hızlı bir zeka/bilmece yarışı yaptığı, sunucu otoriteli,
> mobil öncelikli bir web oyunu.
