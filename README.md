# LRC Roblox

Utility Discord untuk melihat informasi akun, avatar, presence, grup, role grup, dan item Roblox melalui slash command maupun prefix command.

## Command

| Slash | Prefix | Fungsi |
|---|---|---|
| `/help` | `lrc.help` | Menampilkan daftar command dan cara penggunaan. |
| `/ping` | `lrc.ping` | Mengecek respons bot dan koneksi Discord API. |
| `/eggnotify setup` | — | Menyiapkan channel notifikasi dan panel pilihan role egg/event (admin). |
| `/eggnotify status` | — | Menampilkan status konfigurasi egg notifier. |
| `/eggnotify test` | — | Menampilkan preview embed tanpa ping role. |
| `/profile username` | `lrc.profile username` | Menampilkan profil Roblox, User ID, display name, umur akun, status, dan grup. |
| `/presence username` | `lrc.presence username` | Menampilkan status Offline, Online, Sedang bermain, atau Roblox Studio. |
| `/group group` | `lrc.group group` | Menampilkan informasi grup Roblox berdasarkan nama atau Group ID. |
| `/grouproles group` | `lrc.grouproles group` | Menampilkan daftar rank, Rank ID, dan Role ID dari grup Roblox. |
| `/item asset` | `lrc.item asset` | Menampilkan informasi item Roblox berdasarkan Asset ID. |
| `/checkavatarid username` | `lrc.checkavatarid username` | Menampilkan avatar dan daftar item yang sedang digunakan beserta Asset ID. |
| `/checkavatarlink username` | `lrc.checkavatarlink username` | Menampilkan avatar dan daftar item sebagai tautan menuju halaman Roblox. |

## Contoh penggunaan

```text
/profile Rullzz4SchulloLRC
/presence Rullzz4SchulloLRC
/group 573957203
/grouproles 573957203
/item 104536729705573
/checkavatarid Rullzz4SchulloLRC
/checkavatarlink Rullzz4SchulloLRC
```

```text
lrc.profile Rullzz4SchulloLRC
lrc.presence Rullzz4SchulloLRC
lrc.group 573957203
lrc.grouproles 573957203
lrc.item 104536729705573
lrc.checkavatarid Rullzz4SchulloLRC
lrc.checkavatarlink Rullzz4SchulloLRC
```

## Status presence

- **Offline**: akun tidak sedang aktif di Roblox.
- **Online**: akun sedang membuka Roblox atau berada di lobby, tetapi belum masuk ke experience.
- **Sedang bermain**: akun sedang berada di dalam experience; lokasi dan Place ID akan ditampilkan jika tersedia.
- **Roblox Studio**: akun sedang menggunakan Roblox Studio.

## Perbedaan check avatar

### `checkavatarid`

Cocok untuk pengguna yang membutuhkan Asset ID. Setiap item ditampilkan bersama ID Roblox-nya.

### `checkavatarlink`

Cocok untuk pengguna yang ingin membuka item secara langsung. Nama item ditampilkan sebagai tautan yang dapat diklik menuju halaman Roblox.

## Environment

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
PORT=3000
ROBLOX_CACHE_TTL=60000
AUTO_REGISTER_COMMANDS=false
EGG_DATA_DIR=./data
EGG_WEBHOOK_SECRET=
EGG_EVENT_POLL_MS=300000
EGG_TIMEZONE=Asia/Jakarta
```

Jangan menyimpan token bot di repository. File `.env` harus tetap masuk `.gitignore`.

## Menjalankan

```bash
npm install
npm run check
npm run register
npm start
```

Untuk penggunaan prefix `lrc.`, aktifkan **Message Content Intent** pada Discord Developer Portal.

## Deployment Railway

Di Railway Variables, pastikan `DISCORD_TOKEN` dan `CLIENT_ID` terisi. Untuk command baru, set `AUTO_REGISTER_COMMANDS=true` agar command diperbarui saat bot siap. Gunakan `GUILD_ID` hanya jika ingin slash command didaftarkan untuk satu server tertentu; biarkan kosong untuk command global.

## Keamanan

Bot tidak membutuhkan password Roblox, kode 2FA, cookie `.ROBLOSECURITY`, atau data login pengguna. Jangan pernah memberikan informasi tersebut kepada siapa pun.

## Author

`</> crafted by Rullvelion`

## Notifikasi Steal An Egg

Fitur notifikasi tersedia melalui `/eggnotify` dan menggunakan role yang bisa dipilih anggota server. Slash command ini khusus pengelola server (Manage Server).

### Setup Discord

1. Jalankan `npm run register` setelah command baru ditambahkan.
2. Pastikan bot memiliki izin **Manage Roles**, **View Channels**, **Send Messages**, dan **Embed Links**. Bot juga harus berada di atas role notifikasi pada hierarki role Discord.
3. Buat channel teks privat untuk sumber (mis. `#egg-source`) dan berikan bot izin View Channel. Buat Discord Webhook pada channel tersebut.
4. Jalankan `/eggnotify setup`, pilih channel notifikasi, channel panel role, dan `source_channel` sebagai channel privat sumber. Bot akan menyiapkan role kategori dan panel tombol.
5. Jika memakai EggWatch Windows companion, masukkan URL webhook Discord dari `#egg-source` ke pengaturan webhook companion. Selama companion memantau Roblox dan mengirim embed spawn ke channel sumber, LRC Roblox akan membaca hanya pesan webhook dari channel itu, memformat ulang alert, lalu ping role pilihan pada channel notifikasi.
6. Anggota menekan tombol kategori untuk mendapatkan/melepas role. `/eggnotify test` menampilkan contoh embed tanpa ping siapa pun; `/eggnotify status` menampilkan pengaturan.

### Sumber data dan batasannya

Bot memantau event publik Roblox yang tercatat di API Virtual Events, tetapi API itu bukan feed spawn egg individual dan tidak dapat memastikan status event in-game. Untuk spawn individual, jalur tercepat yang disiapkan di sini adalah channel sumber webhook Discord: companion yang membaca game secara lokal dapat mengirim alert ke webhook channel itu, lalu LRC Roblox meneruskan alert ke channel milikmu.

Jika memakai EggWatch, dokumentasinya menyatakan companion Windows membaca pengumuman pada jendela Roblox dan dapat mengirim alert spawn terpilih ke Discord webhook. Ini membutuhkan PC Windows dengan Roblox terbuka dan companion aktif; website publik saat diperiksa menampilkan watcher offline, jadi jangan menganggap feed publik sedang aktif. Jika tidak ada PC/watcher yang aktif, bot tidak bisa mengetahui spawn yang benar-benar terjadi hanya dari timer.

Selain channel sumber, endpoint HTTP `POST /egg-events` tetap tersedia untuk penyedia data yang mengirim JSON. Atur `EGG_WEBHOOK_SECRET` dengan nilai acak yang panjang. Endpoint menerima header `Authorization: Bearer <EGG_WEBHOOK_SECRET>`, `X-Egg-Webhook-Secret`, atau parameter URL `?key=<EGG_WEBHOOK_SECRET>`. Payload dapat berupa JSON event yang didokumentasikan di bawah atau payload embed standar Discord webhook.

Contoh payload spawn egg:

```json
{
  "id": "spawn-event-id-123",
  "type": "egg_spawn",
  "tier": "Secret",
  "egg": "Gargoyle",
  "location": "Demons",
  "spawnedAt": "2026-10-12T01:40:00+07:00",
  "money": "~$225m/s",
  "recommendedSpeed": "20B",
  "joinUrl": "https://www.roblox.com/games/107778070777162/Steal-An-Egg",
  "imageUrl": "https://example.com/egg-image.png"
}
```

Contoh payload event:

```json
{
  "id": "butterfly-event-123",
  "type": "event",
  "category": "butterfly",
  "title": "Butterfly Bloom",
  "description": "Butterfly Bloom is Active!",
  "status": "active",
  "changedAt": "2026-10-12T01:30:00+07:00",
  "nextChangeAt": "2026-10-12T02:00:00+07:00",
  "joinUrl": "https://www.roblox.com/games/107778070777162/Steal-An-Egg"
}
```

Endpoint di atas adalah **penerima data**, bukan penyedia feed spawn. Agar notifikasi spawn betulan terkirim, masih perlu menghubungkannya dengan sumber yang benar-benar menyediakan data spawn/event real-time. Jangan gunakan endpoint atau key yang tidak jelas asalnya, dan jangan pernah memasukkan token Discord ke payload webhook.

### Railway dan penyimpanan konfigurasi

Tambahkan variables `EGG_DATA_DIR=/app/data`, `EGG_WEBHOOK_SECRET=<secret-acak>`, dan opsional `EGG_EVENT_POLL_MS=300000` serta `EGG_TIMEZONE=Asia/Jakarta`. Buat Railway Volume dengan mount path `/app/data` agar channel, role ID, dan riwayat event tetap tersimpan setelah redeploy/restart. Jika tidak menggunakan volume, file konfigurasi lokal berpotensi hilang saat deployment diganti.

Untuk mendaftarkan slash command baru otomatis saat bot siap, set `AUTO_REGISTER_COMMANDS=true` dan pastikan `CLIENT_ID` serta `DISCORD_TOKEN` sudah terisi di Railway. Jika variabel ini dibiarkan `false`, daftarkan command secara manual menggunakan `npm run register`. Biarkan `GUILD_ID` kosong jika bot memakai command global; command global dapat memerlukan waktu untuk muncul di Discord.
