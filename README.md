# Screening CV — Versi Vite + React + TypeScript

Aplikasi web satu halaman untuk menilai CV berbahasa Indonesia atau Inggris (skor memakai kamus bahasa CV-nya, semua pesan hasil berbahasa Indonesia): pengguna memasukkan
CV, lalu menerima Skor Siap 0–95 dan — bila ada lowongan — Skor Cocok dengan
lowongan itu, beserta bagian mana saja yang perlu diperbaiki.
Ini adalah versi project (Vite + React + TypeScript) dari website Screening CV.

## Cara Menjalankan

```bash
npm install     # pasang dependency (sekali saja)
npm run dev     # jalankan server pengembangan (http://localhost:5173)
npm run build   # build produksi ke folder dist/ (termasuk cek TypeScript)
npm run preview # pratinjau hasil build
```

Uji logika penilaian (opsional):

```bash
npx tsx scripts/run-tests.ts
```

Menjalankan frontend + backend AI bersamaan (untuk fitur Analisis AI):

```bash
npm run dev:ai   # sama dengan npx vercel dev; butuh Vercel CLI + OPENROUTER_API_KEY di .env.local
```

Catatan: `npm run dev` hanya menjalankan website (skor standar tetap jalan), tapi **tidak** menjalankan server AI — tombol Analisis AI akan gagal. Di Vercel (production) AI jalan karena `/api/analyze-ai` aktif di sana.

## Fitur

- Upload CV **PDF** (pdfjs-dist, worker dari paket itu sendiri), **DOCX** (mammoth),
  atau **TXT** — bisa drag & drop — atau tempel teks CV langsung.
- Pilih mode **Fresh Graduate** atau **Berpengalaman** sebelum menilai. Mode
  menentukan sumber bukti yang dicari, bukan bonus poin.
- Input posisi target dan deskripsi lowongan (opsional) — mengaktifkan **Skor Cocok**.
- Hasil: dua ring skor beranimasi (Skor Siap dan Skor Cocok), bar per aspek beserta
  alasan tiap poin, bukti STAR terbaik, daftar kekuatan, prioritas perbaikan
  terurut dengan detail per pemeriksaan, cek kata kunci lowongan (di bukti /
  hanya klaim / belum ada), tombol salin laporan, tombol reset, dan tombol
  "Coba CV Contoh".
- Penghitung karakter/kata langsung pada textarea CV.
- **Analisis AI (OpenRouter)** — opsional, atas persetujuan pengguna: saran
  penulisan ulang, kekurangan kualitatif, dan contoh ringkasan profil dari
  backend `api/analyze-ai.ts` (lihat bagian Backend AI). Hanya untuk testing
  dan **tidak mengubah skor**.

## Struktur Folder

```
api/
  analyze-ai.ts      Backend Analisis AI (Vercel Serverless Function → OpenRouter)
src/
  App.tsx            Komponen utama (hero, cara kerja, form, hasil, transparansi, tips)
  App.css            Seluruh gaya aplikasi
  index.css          Gaya dasar (reset & font)
  lib/
    analyze.ts       Logika penilaian berbasis bukti (murni TypeScript, tanpa DOM)
    ai.ts            Klien frontend untuk POST /api/analyze-ai
    sampleCv.ts      Teks CV contoh bawaan
    readFile.ts      Ekstraksi teks dari file PDF/DOCX/TXT
scripts/
  run-tests.ts       Uji logika penilaian: contoh A/B/C, fresh graduate, anti-akali, dua skor
```

## Aturan Penilaian (total 100 poin, 6 aspek, plafon realistis 95)

Prinsip: **nilai bukti, bukan kata.** Poin hanya diberikan untuk bukti isi yang
benar-benar ada, di tempat yang benar; bagian kosong = 0. Total mentah 96–100
ditampilkan sebagai **95** — tidak ada CV yang sempurna untuk semua lowongan.

| Aspek | Maks | Pemeriksaan |
| --- | --- | --- |
| Kontak | 15 | Email valid (6), nomor HP Indonesia (5), LinkedIn (2), link karya (2) |
| Ringkasan | 10 | Panjang cukup 20–60 kata (4), menyebut peran target (3), merujuk bukti terkuat (3) |
| Bukti STAR | 30 | Rata-rata STAR dari 3 bukti terbaik (Peran 2,5 / Periode 2,5 / Aksi 2,5 / Hasil 2,5 per bukti) |
| Pendidikan & Belajar | 15 | Pendidikan tercantum (8), IPK / sertifikat gabungan maks 7 |
| Skill Relevan | 15 | Skill terbukti di dalam bukti (9), relevansi dengan lowongan (6) |
| Format & ATS | 15 | Panjang 220–900 kata (6), struktur terbaca (5), bullet pada bukti (4) |

- **Bukti STAR**: satu bukti = satu pengalaman kerja, magang, proyek, organisasi,
  tugas akhir, freelance, atau volunteer. Hanya 3 bukti terbaik yang dihitung
  (dirata-rata, lalu dikali 3); bukti ke-4 dan seterusnya masuk daftar Kekuatan.
  Bukti yang sama di dua tempat dihitung satu kali (nama tempat + periode).
- **Nomor HP**: rangkaian digit yang boleh berisi spasi, strip, titik, kurung, dan
  awalan `+` dibersihkan dulu, lalu divalidasi sebagai satu nomor utuh
  (`08…` total 10–14 digit, atau `628…` total 11–15 digit). Tahun, nomor kantor
  021, dan IPK tidak terdeteksi sebagai HP.
- **Link karya**: URL di domain GitHub, GitLab, Behance, Dribbble, Kaggle,
  Bitbucket, CodePen, ArtStation, Notion, `*.vercel.app`, `*.netlify.app`,
  `*.github.io`, atau URL apa pun pada baris berlabel "Portofolio". Kata
  "portofolio" tanpa alamat tidak dihitung. Bila bidangnya tidak memamerkan
  karya, 1 dari 2 poin dialihkan ke LinkedIn + domisili.
- **Hasil terukur**: angka dengan `%`/satuan (juta, ribu, orang, klien, proyek,
  jam, hari, bulan, tahun) atau nominal `Rp`, dengan tahun kalender dan fragmen
  nomor HP dikecualikan. **Hanya dihitung bila berada di dalam sebuah bukti**
  — angka di ringkasan atau daftar skill tidak menambah poin Bukti.
- **IPK / sertifikat**: IPK hanya dihitung bila ada di dalam bagian pendidikan.
  Bila IPK tidak ada tetapi ada sertifikat/pelatihan relevan, sertifikat
  menggantikannya (gabungan IPK + sertifikat maksimal 7).
- **Skill relevan**: skill hanya bernilai bila muncul di dalam minimal satu bukti.
  Skill yang hanya ada di daftar skill bernilai 0 dan ditampilkan sebagai
  "skill belum terbukti". Duplikat dan sinonim (mis. "MS Excel" = "Excel")
  dihitung satu kali.
- **Label**: 85–95 "Sangat Siap Dilamar", 70–84 "Sudah Bagus", 50–69
  "Perlu Perbaikan", <50 "Perlu Dirombak Dulu". Berlaku untuk Skor Siap dan Skor Cocok.
- **Skor Cocok** (hanya bila ada posisi target / deskripsi lowongan):
  70% Skor Siap + 30% kata kunci lowongan yang ditemukan **di dalam bukti**.
  Kata kunci yang hanya ada di CV (bukan di bukti) ditampilkan sebagai "hanya klaim".
- **Mode Fresh Graduate / Berpengalaman**: dipilih user, batas bawah bukan batas
  atas. Fresh graduate dengan banyak pengalaman tidak dihukum dan tidak dihitung
  ganda. Bila mode Fresh Graduate tetapi ada kerja penuh waktu > 1 tahun, sistem
  menampilkan catatan untuk mencoba mode Berpengalaman.

## Backend AI (OpenRouter) — fitur "Analisis AI"

Selain penilaian rule-based, ada fitur opsional **Analisis AI** yang memakai
AI lewat **OpenRouter** (model default **NVIDIA Nemotron 3 Ultra 550B
(free)**, `nvidia/nemotron-3-ultra-550b-a55b:free`) untuk saran kualitatif: penulisan ulang poin
pengalaman, daftar kekurangan (terhadap lowongan bila diisi), dan contoh
ringkasan profil. Fitur ini **tidak mengubah skor utama** dan dipakai **hanya
untuk testing** — model gratis bisa lambat atau kena rate limit.

### Arsitektur

```
Browser ──POST /api/analyze-ai──▶ Vercel Serverless Function ──▶ OpenRouter
         {cvText, targetRole,      (api/analyze-ai.ts,            (Chat Completions,
          jobDesc}                   API key di env server)         JSON terstruktur)
```

- Endpoint hanya menerima `POST` JSON: `cvText` (wajib, 50–12.000 karakter),
  `targetRole` (opsional), `jobDesc` (opsional, maks 6.000 karakter).
- Ada rate limit sederhana in-memory: maks 5 permintaan per 10 menit per IP
  (best-effort per instance fungsi).
- Frontend hanya memanggil endpoint setelah pengguna mencentang persetujuan
  pengiriman teks CV. Bila OpenRouter membalas rate limit (429), endpoint
  meneruskannya sebagai 429 dan analisis standar tetap bisa dipakai.
- Error OpenRouter lain dipetakan rapi: 401/403 (key ditolak) dan 402 (kredit
  tidak cukup) menjadi 502 dengan penjelasan + field `detail` berisi status
  dan pesan resmi OpenRouter (tanpa key dan tanpa isi CV).
- Pengaman untuk model reasoning & model gratis yang lambat: permintaan
  dikirim dengan parameter `reasoning: {effort: "low"}` agar model tidak
  menghabiskan jatah token hanya untuk berpikir, dan dibatasi **timeout
  55 detik** (AbortController) — lewat dari itu endpoint membalas 502
  "terlalu lama merespons". Bila model menolak parameter opsional
  (`reasoning`/`response_format`) dengan error 400, endpoint mengulang
  permintaan dengan membuang parameter yang ditolak (maksimal 2 kali).

### Mode streaming (panel proses berpikir)

Frontend memanggil endpoint dengan `"stream": true` agar proses berpikir
model terlihat langsung di panel "Proses berpikir AI". Dalam mode ini
respons bukan lagi satu JSON, melainkan aliran **NDJSON**
(`Content-Type: application/x-ndjson`, satu event JSON per baris):

- `{"type":"reasoning","text":"..."}` — potongan penalaran model, diambil
  dari `delta.reasoning` / `delta.reasoning_details`; penalaran yang
  tercampur ke `delta.content` dalam blok `<think>...</think>` dipisahkan
  ke event ini juga.
- `{"type":"result","data":{...}}` — satu kali di akhir, hasil analisis
  dengan skema yang sama seperti mode non-streaming.
- `{"type":"error","error":"...","detail":"..."}` — kegagalan di tengah
  aliran (error upstream, timeout, atau jawaban tidak terparse), dengan
  pesan dan detail diagnostik yang sama seperti mode non-streaming.

Error **sebelum** aliran dimulai (validasi, rate limit, key belum
terpasang, upstream menolak di awal) tetap dibalas sebagai JSON biasa
dengan status HTTP seperti mode non-streaming. Parameter khusus jalur
streaming: `reasoning: {effort: "medium"}`, `max_tokens` 6000, dan batas
waktu keseluruhan aliran **90 detik**. Mode non-streaming tidak berubah
(effort low, `max_tokens` 3000, timeout 55 detik). Di sisi frontend, panel
menampilkan teks penalaran secara langsung (dibatasi ±8.000 karakter)
beserta penghitung detik; setelah selesai panel terlipat menjadi ringkasan
yang bisa dibuka lagi. Bila permintaan streaming gagal sebelum event
pertama tiba, frontend otomatis mencoba sekali mode non-streaming sebagai
cadangan.

### Memasang API key

1. Buat API key di **OpenRouter**: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
2. Di **Vercel**: Project `screening-cv-app` → Settings → Environment Variables →
   tambahkan `OPENROUTER_API_KEY` (dan opsional `OPENROUTER_MODEL`, default
   `nvidia/nemotron-3-ultra-550b-a55b:free`).
3. **Redeploy** project (Deployments → ⋯ → Redeploy) agar variabel terbaca.
4. Untuk uji lokal: salin `.env.example` menjadi `.env.local`, isi key-nya,
   lalu jalankan `npx vercel dev`.

Tanpa key, endpoint membalas `500` dengan pesan "OPENROUTER_API_KEY belum
terpasang" dan bagian Analisis AI menampilkan pesan itu — situs dan analisis
standar tidak terganggu.

### Catatan biaya & privasi

- Model default adalah varian **gratis** (`:free`) di OpenRouter, jadi tidak
  butuh kredit — tetapi kapasitas provider gratis terbatas: endpoint bisa
  membalas **429** (rate limit/kuota gratis penuh) atau timeout saat model
  sedang lambat. Bila `OPENROUTER_MODEL` diganti ke model berbayar, model itu
  dipungut biaya per token dan butuh kredit OpenRouter: error **402**
  artinya **kredit OpenRouter tidak cukup** — isi kredit atau periksa batas
  pemakaian akun.
- Pantau pemakaian dan biaya di dashboard OpenRouter.
- Aplikasi sendiri **tidak menyimpan** teks CV: fungsi backend hanya
  meneruskannya ke OpenRouter dan tidak mencatat isinya ke log.

## Catatan

- **Analisis standar 100% client-side**: penilaian rule-based tidak memakai
  backend, database, atau pengiriman data ke server — file dan teks CV hanya
  diproses di browser pengguna. Satu-satunya pengecualian adalah fitur
  Analisis AI di atas, yang hanya berjalan atas persetujuan pengguna.
- Penilaian standar bersifat **rule-based** (berbasis aturan) — bukan
  keputusan rekruter.
