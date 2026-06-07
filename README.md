# MultiUserPaint — Çok Kullanıcılı Resim Çizme Uygulaması (v2)

Bu proje, birden fazla kullanıcının eş zamanlı olarak bir resim tuvali üzerinde ortaklaşa çizim ve düzenleme yapabilmesini sağlayan bir **Masaüstü Resim Düzenleyici** uygulamasıdır. 

Proje, **Ağ İletişimi** dersi kapsamında geliştirilmiş olup, birinci aşamada yalın TCP soket programlama ile yazılan iletişim altyapısı, ikinci aşamada **Socket.IO (WebSocket)** üzerine taşınmıştır.

---

## 🚀 Proje Mimarisi

*   **Sunucu (Server):** Node.js + Socket.IO v4 (WebSocket + HTTP Polling Fallback)
*   **İstemci (Client):** Electron (HTML5 Canvas + CSS3 + Javascript Renderer) + socket.io-client
*   **Protokol:** Socket.IO olay tabanlı mesajlaşma (`emit/on`)
*   **Oda Yönetimi:** Socket.IO Room mekanizması (lobby + dosya odaları)
*   **Heartbeat:** Socket.IO Engine.IO dahili ping/pong (otomatik)
*   **Yeniden Bağlanma:** Otomatik reconnection (exponential backoff)

---

## 🔄 Birinci Aşamadan Farklar

| Özellik | v1 (TCP) | v2 (Socket.IO) |
|---|---|---|
| Transport | Raw TCP (`net` modülü) | WebSocket (Engine.IO) |
| Çerçeveleme | Manuel `[4-Byte] + [JSON]` | Otomatik (Engine.IO) |
| Ayrıştırma | `ProtocolParser` sınıfı | Otomatik JSON |
| Mesaj Yönlendirme | `switch-case` + `msg.type` | Olay adlarıyla `socket.on()` |
| Broadcast | Manuel soket döngüsü | `socket.to(room).emit()` |
| Heartbeat | Manuel `setInterval` | Otomatik `ping/pong` |
| Yeniden Bağlanma | ❌ Yok | ✅ Otomatik |
| Oda Yönetimi | Manuel filtre | `socket.join/leave/to` |

---

## 🛠️ Kurulum ve Başlatma Rehberi

### Adım 1: Sunucu Bağımlılıklarını Yükleme
Bir komut satırı açın ve `server` klasörüne gidin:
```bash
cd server
npm install
```

### Adım 2: İstemci Bağımlılıklarını Yükleme
```bash
cd client
npm install
```

---

### Adım 3: Sunucuyu Başlatma
```bash
cd server
node index.js
```
*Ekranda `Dinleniyor: 0.0.0.0:5000` yazısını gördüğünüzde sunucu hazır demektir.*

---

### Adım 4: İstemcileri Çalıştırma
```bash
cd client
npx electron .
```

---

## 👥 Çok Kullanıcılı Test Senaryosu

Çok kullanıcılı eş zamanlı çizim sistemini test etmek için aynı bilgisayarda birden fazla istemci açabilirsiniz:

1. `client` klasörü konumunda **yeni bir terminal penceresi daha açın** ve tekrar şu komutu çalıştırın:
   ```bash
   npx electron .
   ```
   *Böylece ekranınızda iki adet bağımsız masaüstü penceresi açılmış olacaktır.*

2. **Birinci Pencerede:**
   * Sunucu Adresi: `localhost`
   * Port: `5000`
   * Kullanıcı Adı: `Zubeyir` yazıp **Bağlan** deyin.
   * **Yeni Dosya** butonuna basarak bir tuval oluşturun ve üzerine çift tıklayıp açın.

3. **İkinci Pencerede:**
   * Sunucu Adresi: `localhost`
   * Port: `5000`
   * Kullanıcı Adı: `Ali` yazıp **Bağlan** deyin.
   * Dosya listesinde `Zubeyir`'in oluşturduğu dosyayı göreceksiniz. Dosyaya tıklayarak düzenleme moduna girin.

4. **Sonuç:** Pencerelerden birinde yaptığınız çizimler, katman ekleme/çıkarma, kesme/silme işlemleri **anlık ve kayıpsız olarak** diğer kullanıcının ekranında da belirecektir. Sunucu üzerindeki dosyalar her 30 saniyede bir otomatik olarak `server/storage` klasörüne JSON formatında kaydedilir.

---

## 📄 Proje Klasör Yapısı

```text
├── shared/
│   ├── events.js           # Socket.IO olay adları sabitleri (EventType)
│   └── protocol.js         # [Eski] TCP protokol dosyası (referans için korunuyor)
├── server/
│   ├── index.js            # Socket.IO Sunucusu (PaintServer sınıfı)
│   ├── sessionManager.js   # Oturum yönetimi (socket.id tabanlı)
│   ├── fileManager.js      # Dosya CRUD + otomatik kaydetme
│   ├── package.json        # socket.io bağımlılığı
│   └── storage/            # Otomatik kaydedilen tuval JSON dosyaları
└── client/
    ├── main.js             # Electron Main Process + socket.io-client
    ├── preload.js          # IPC Güvenli Köprü Katmanı
    ├── package.json        # socket.io-client + electron bağımlılığı
    └── renderer/           # Arayüz dosyaları (HTML, CSS, Çizim motoru)
```
