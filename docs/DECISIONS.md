# Mimari Kararlar Günlüğü (ADR)

## ADR-001: Phaser/Unity yerine DOM/React
- Tarih: (proje başlangıcı, hazır kabul edildi)
- Bağlam: Oyunun ekranları metin, buton ve liste; görsel puzzle'lar (MEMORY/SPATIAL) kendi bileşenlerinde SVG/canvas kullanabilir.
- Karar: Canvas tabanlı bir oyun motoru (Phaser/Unity) kullanılmayacak; React + Tailwind ile DOM tabanlı arayüz.
- Alternatifler ve neden elendi: Phaser/Unity responsive metin, mobil klavye, kopyala-yapıştır ve erişilebilirliği elle çözmeyi gerektirir; bundle'ı büyütür (ilk açılış hızı = ürünün 1 numaralı riski).
- Sonuçları / geri dönüş maliyeti: İleride görsel ağırlıklı puzzle tipleri gerekirse motor değil, tek bir bileşen (SVG/canvas) eklenir; mimari değişmez.

## ADR-002: Colyseus 0.17
- Tarih: (proje başlangıcı, hazır kabul edildi)
- Bağlam: Oda, matchmaking, state senkronu, reconnection'ı sıfırdan `ws` ile yazmak haftalarca sürer.
- Karar: Colyseus 0.17 (`defineServer()` + `defineRoom()`) kullanılacak.
- Alternatifler ve neden elendi: Ham `ws`/Socket.io — state senkronu ve reconnection'ı elle yazmak gerekir.
- Sonuçları / geri dönüş maliyeti: API her kod yazımından önce `docs.colyseus.io`'dan doğrulanır; hafızadan eski `gameServer.define(...)` API'si yazılmaz (FAZ 0'da bunun neden kritik olduğu somut şekilde görüldü, bkz. ADR-005).

## ADR-003: Hassas veri Colyseus state'ine konmaz
- Tarih: (proje başlangıcı, hazır kabul edildi)
- Bağlam: Colyseus `state` tüm oyunculara otomatik senkronlanır ve görünür; doğru cevabı state'e koymak DevTools'tan okunabilir hale getirir.
- Karar: `correctChoiceId`, şık permütasyonları ve aktif turun `ServerPuzzle`'ı state dışında, `MatchController` içinde normal TS nesnesi olarak tutulur; sadece `round:result` mesajıyla (tur bittikten sonra) client'a gider.
- Alternatifler ve neden elendi: Colyseus 0.16+'daki `StateView` ile oyuncuya özel filtreleme mümkün, ama "hassas veriyi state'e hiç koyma" MVP için daha basit ve daha güvenli.
- Sonuçları / geri dönüş maliyeti: FAZ 4-5'te puzzle/puanlama eklenirken bu kural GameRoom/MatchController tasarımını doğrudan şekillendirir.

---

## ADR-004: Client SDK paketi `colyseus.js` değil `@colyseus/sdk`
- Tarih: 2026-08-08 (FAZ 0)
- Bağlam: FAZ 0'da client'ı sunucuya bağlarken `colyseus.js@0.16.22` (npm'de hâlâ "latest" etiketli) ile gerçek bir bağlantı denendi. Sunucu (Colyseus 0.17 / `@colyseus/core` 0.17.x) matchmake HTTP yanıtını artık düz bir nesne olarak dönüyor (`{name, sessionId, roomId, processId}`), oysa `colyseus.js@0.16.x` istemcisi `response.room.name` gibi eski, iç içe bir şekil bekliyor. Sonuç: tarayıcıda `TypeError: Cannot read properties of undefined (reading 'name')` — sunucu tarafında hata yok, sorun sadece yanlış client paketiydi. Gerçek tarayıcıda (Playwright ile) test edilmeden bu fark keşfedilemezdi.
- Karar: Client'ta `colyseus.js` yerine `@colyseus/sdk` (^0.17.43) kullanılıyor — Colyseus 0.17 ile birlikte client SDK bu isimle yeniden yayınlanmış. Import: `import { Client, Room } from '@colyseus/sdk'`.
- Alternatifler ve neden elendi: `colyseus.js@next`/`@beta` etiketleri de denendi ama hâlâ 0.16 hattında; sunucuyu eski protokolle uyumlu çalıştırmak (mümkün değil, `@colyseus/core` 0.17 tek bir yanıt şekli üretiyor).
- Sonuçları / geri dönüş maliyeti: Gelecekteki her fazda client tarafı Colyseus kodu (`net/colyseus.ts` ve türevleri) `@colyseus/sdk`'dan import edilmeli. Bir ajan hafızadan `colyseus.js` yazarsa aynı hataya düşer — bu ADR ipucu olarak kalsın.

## ADR-005: pnpm `blockExoticSubdeps` bu workspace'te kapalı
- Tarih: 2026-08-08 (FAZ 0)
- Bağlam: pnpm 11, tedarik zinciri güvenliği için transitive bağımlılıkların git/tarball gibi "exotic" kaynaklardan gelmesini varsayılan olarak engelliyor (`blockExoticSubdeps: true`). Colyseus'un `@colyseus/uwebsockets-transport` (opsiyonel, kullanılmayan bir transport) alt bağımlılığı `uWebSockets.js`'i GitHub'dan tarball olarak çekiyor; `pnpm install` bu yüzden `ERR_PNPM_EXOTIC_SUBDEP` ile başarısız oluyordu.
- Karar: `pnpm-workspace.yaml`'da `blockExoticSubdeps: false` set edildi (yorumla birlikte). Ayrıca `esbuild` ve `msgpackr-extract` (Vite ve Colyseus'un msgpack serileştirmesi için gerekli native build script'leri) `allowBuilds` altında `true` olarak onaylandı.
- Alternatifler ve neden elendi: `@colyseus/uwebsockets-transport`'u override ile bağımlılık ağacından tamamen çıkarmak — gereksiz kırılganlık, biz zaten `@colyseus/ws-transport` kullanıyoruz ve paket hiç çalıştırılmıyor, sadece kurulum sırasında dokunuluyor.
- Sonuçları / geri dönüş maliyeti: `pnpm-workspace.yaml`'daki bu iki ayar bilinçli bir istisna; yeni bir paket eklenip benzer bir hata çıkarsa önce paketin gerçekten neden bu davranışı tetiklediği anlaşılmalı, ayar körü körüne genişletilmemeli.

## ADR-006: `shared` paketi CommonJS'e derleniyor
- Tarih: 2026-08-08 (FAZ 0)
- Bağlam: `shared`, hem `server` (tsx/Node ile çalıştırılıyor) hem `client` (Vite ile bundle ediliyor) tarafından tüketiliyor. TypeScript'in ESM çıktısı, Node ESM yükleyicisinin göreli import'larda açık `.js` uzantısı istemesi yüzünden ekstra karmaşıklık getiriyor.
- Karar: `shared` ve `server`, `module: CommonJS` + `moduleResolution: Node10` ile derleniyor; `client` kendi `tsconfig`'inde `module: ESNext` + `moduleResolution: Bundler` kullanıyor (Vite zaten CJS/ESM interop'unu esbuild ile çözüyor).
- Alternatifler ve neden elendi: Tüm paketlerde ESM + `NodeNext` — göreli import'larda `.js` uzantısı disiplinini üç pakette de sürekli doğru tutmak gerekir, FAZ 0'ın "en küçük çalışan sistem" ilkesine aykırı ek risk.
- Sonuçları / geri dönüş maliyeti: `shared`'a yeni dosya eklerken (FAZ 1'de `messages.ts`/`schemas.ts`) CJS derlemesi aynen sürer; test dosyaları (`*.test.ts`) `shared/tsconfig.json`'da `exclude` edildi ki derlenen `dist/` içine sızıp Vitest'i CJS/ESM çakışmasıyla bozmasın.

## ADR-007: Server dev script `tsx watch` değil `nodemon` kullanıyor
- Tarih: 2026-08-08 (FAZ 0)
- Bağlam: `pnpm dev` gerçek terminalde çalıştırılıp test edilirken sunucu saniyede birkaç kez kendi kendine yeniden başlıyordu (bazen `EADDRINUSE` ile çöküyordu). Kök neden: `tsx watch`, Node'un yerleşik `--watch` moduna dayanıyor ve bu mod, projenin `require`/`import` ettiği **her dosyayı** — Colyseus'un tüm transitif `node_modules` bağımlılıkları (`ioredis`, `ws`, `@colyseus/auth`, `@colyseus/monitor`, `node-os-utils`...) dahil — otomatik izliyor. `tsx watch --exclude '**/node_modules/**'` bunu **engellemiyor**; `--exclude` sadece tsx'in kendi dizin taramasına uygulanıyor, Node'un otomatik modül-izleme kaydına değil.
- Karar: Server'ın `dev` script'i `nodemon --watch src --ext ts --exec tsx src/index.ts` oldu — nodemon'a sadece `src/` dizini açıkça (whitelist) izlettiriliyor, `node_modules` hiç görülmüyor.
- Alternatifler ve neden elendi: `tsx watch --exclude` (denendi, işe yaramadı — yukarıda açıklandı); Node'un çıplak `--watch` flag'i (aynı kök soruna sahip, tsx'in üstünde çalıştığı mekanizmanın ta kendisi).
- Sonuçları / geri dönüş maliyeti: `packages/server/package.json`'a `nodemon` devDependency olarak eklendi. Gelecekte server tarafına yeni bir çalışma zamanı dosya izleme ihtiyacı (örn. `content/*.json` puzzle havuzları FAZ 10'da) çıkarsa `nodemon.json`'da `--watch` listesine eklenir; `node_modules`'a asla dokunulmaz.

## ADR-008: Oda kodu ile katılma, `matchMaker.join()` değil özel bir HTTP endpoint üzerinden yapılıyor
- Tarih: 2026-08-08 (FAZ 1)
- Bağlam: `03-ARCHITECTURE.md` §4.1 ve `05-ROADMAP.md` FAZ 1 promptu, oda kodu ile katılmanın `defineRoom(GameRoom).filterBy(['roomCode'])` + `this.setPrivate()` + client'ın `client.join('game', {roomCode})` çağrısıyla çalışacağını varsayıyordu. Bu repodaki gerçek `@colyseus/core@0.17.49` kaynağı (`node_modules` içinden doğrudan okunarak) doğrulandı: `matchMaker.join()`/`joinOrCreate()`, dahili `findOneRoomAvailable()` fonksiyonu üzerinden sorguya **koşulsuz** `private: false` koşulu ekliyor (`MatchMaker.ts`). Yani `setPrivate()` çağrılmış bir oda — `filterBy` ve `metadata.roomCode` doğru ayarlanmış olsa bile — `client.join()`/`joinOrCreate()` ile **hiçbir zaman** bulunamıyor. `setPrivate()`'ı kaldırıp yalnızca `filterBy`'a güvenmek de çözüm değil: bu durumda oda `private:false` kalır ve Colyseus'un yerleşik `/matchmake/game` listeleme endpoint'i (client `getAvailableRooms()` çağırmasa bile doğrudan HTTP ile erişilebilir) odayı ve `metadata.roomCode`'unu tüm dünyaya sızdırır — GDD'nin "oda listelenmez, kimse rastgele odaları göremez" gereksinimini (bkz. ADR-003 ruhu) doğrudan ihlal eder.
- Karar: Oda private kalıyor (`this.setMatchmaking({metadata:{roomCode}, private:true})`, `onCreate` içinde). Kod→oda eşlemesi, sunucuda özel bir `POST /rooms/join-by-code` Express route'unda (`server/src/http/joinByCode.ts`) yapılıyor: `matchMaker.query({name:'game', roomCode})` (bu fonksiyon `private` filtresi eklemiyor, private odaları da buluyor) ile oda bulunuyor, `locked`/`maxClients` elle kontrol edilip protokolün kendi `ErrorCode`'ları (`E_ROOM_NOT_FOUND`/`E_MATCH_STARTED`/`E_ROOM_FULL`) JSON olarak dönülüyor, sonra `matchMaker.joinById(room.roomId, {nickname})` (bu da `private`'a bakmıyor, sadece `locked` kontrol ediyor) ile seat reservation alınıp client'a dönülüyor. Client bunu `client.consumeSeatReservation(json)` ile WS bağlantısına çeviriyor (`client/src/net/colyseus.ts`). `filterBy(['roomCode'])` yine de `GameRoom` tanımında bırakıldı — fiilen bu akışta yük taşımıyor ama `metadata.roomCode` tipini deklare ediyor ve niyeti belgeliyor.
- Alternatifler ve neden elendi: (1) `setPrivate()` kaldırıp `filterBy`+`join()` — yukarıda açıklandığı gibi oda listesini sızdırıyor, reddedildi. (2) İki ayrı HTTP çağrısı (önce kod→roomId lookup, sonra client'ın kendi `client.joinById(roomId)` çağrısı) — çalışırdı ama ekstra round-trip gerektirir ve kapasite/kilit kontrolünü Colyseus'un kendi genel `SeatReservationError` mesajına ("X is already full") bırakırdı; bunun yerine tek endpoint'te önden kontrol edip kendi `ErrorCode`'larımızı dönmek tercih edildi.
- Sonuçları / geri dönüş maliyeti: Gelecekteki fazlarda oda bulma mantığı değişirse (`server/src/http/joinByCode.ts`) tek yerden güncellenir; hem prod `index.ts` hem `GameRoom.test.ts` aynı handler'ı kullanıyor, sürüklenme riski yok. Ayrıca doğrulandı: Colyseus, ham HTTP sunucusu seviyesinde (`@colyseus/core/src/router/index.ts`, `bindRouterToTransport`) **tüm route'lara** (yalnızca `/matchmake` değil) izin verici, origin'i yansıtan CORS başlıkları otomatik ekliyor — bu yüzden `/rooms/join-by-code` için elle CORS middleware yazmaya gerek yok (ilk yazılan elle CORS kodu, canlı sunucuya karşı curl ile test edilince bu Colyseus davranışının önüne asla geçmediği görülüp kaldırıldı). Gerçek origin kısıtlaması hâlâ yok — bu, FAZ 8'in ("WS origin beyaz listesi") kapsamı.
- İlgili ikinci bulgu (aynı oturumda, GameRoom.onCreate içindeki `player:setNickname` handler'ını yazarken doğrulandı): Colyseus 0.17'nin `onMessage(type, zodSchema, handler)` 3 parametreli "validated" overload'ı, doğrulama başarısız olduğunda `client.leave(CloseCode.WITH_ERROR)` ile client'ı sertçe bağlantıdan atıyor (`@colyseus/core/src/Room.ts`, mesaj dispatch bloğu) — `error` mesajı göndermiyor. Bu, CLAUDE.md'nin "reddedilen mesajda `error` gönderilir ve loglanır, sessizce yutulmaz" kuralını ihlal ediyor (sert atma, sessiz yutmadan da kötü). Bu yüzden proje genelinde zod şemalı 3 parametreli overload **kullanılmayacak**; her mesaj handler'ı düz 2 parametreli `onMessage(type, cb)` + elle `schema.safeParse()` + `client.send('error', {code, message})` deseniyle yazılacak. Bu kural sonraki fazlardaki tüm `onMessage` kullanımlarını bağlıyor.
