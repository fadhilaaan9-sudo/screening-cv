# Rubrik Patokan CV yang Bagus

Patokan tertulis agar penilaian AI konsisten dan bisa diperiksa pengguna.
Ini panduan yang disesuaikan untuk fresh graduate Indonesia — bukan hukum.

## Sumber

1. **Harvard Office of Career Services (Mignone Center for Career Success)** — panduan
   dan template resume: 1 halaman untuk mahasiswa/lulusan baru, pendidikan di
   atas pengalaman, tiap poin dimulai kata kerja aksi dan diakhiri hasil
   terukur, tanpa kata ganti orang, frasa bukan kalimat penuh.
2. **Laszlo Bock (mantan SVP People Operations Google)**, LinkedIn 2014,
   "My Personal Formula for a Winning Resume" — rumus XYZ:
   `Accomplished [X] as measured by [Y] by doing [Z]`.
   Ini saran dari praktisi hiring, bukan standar resmi perusahaan.
3. **Jobscan 2025 ATS Usage Report** (97,8% perusahaan Fortune 500 memakai ATS)
   dan **MIT Career Advising** ("Avoid use of graphics, icons, or images") —
   satu kolom, heading standar, tanpa tabel/gambar, kata kunci lowongan dipakai
   dalam konteks, bukan ditumpuk.
4. **Penyesuaian lokal:** ringkasan singkat tetap dipakai karena pemberi kerja
   Indonesia umumnya mengharapkannya (template Harvard versi AS justru tanpa
   ringkasan). Sertifikat/IPK boleh menggantikan pengalaman kerja untuk fresh
   graduate.

## Rubrik (R1–R10)

| Kode | Patokan | Dipakai di skor standar |
| ---- | ------- | ----------------------- |
| R1 | **Panjang:** 1 halaman untuk fresh graduate / pengalaman di bawah 10 tahun. | Format & ATS |
| R2 | **Struktur:** satu kolom, urutan terbaru dulu, heading standar (Kontak, Ringkasan, Pengalaman Kerja, Pendidikan, Keahlian, Sertifikasi). | Format & ATS |
| R3 | **Kontak:** nama, email, HP, LinkedIn/portfolio ada di badan dokumen (bukan header/footer) dan aktif. | Kontak |
| R4 | **Ringkasan:** 2–3 kalimat, sebut posisi target dan bukti terkuat, bukan daftar sifat umum. | Ringkasan |
| R5 | **Bukti (rumus XYZ Google):** tiap poin pengalaman = kata kerja aksi + hasil + angka. Poin yang hanya berisi tugas, tanpa hasil, itu lemah. | Bukti STAR |
| R6 | **Angka jujur:** angka hanya yang benar dan terukur; bila tidak ada angka, pakai skala (pengguna, tim, durasi) atau placeholder `[X%]`/`[jumlah]` — jangan karang. | Bukti STAR |
| R7 | **Tanggal:** tiap pengalaman/proyek ada periode (bulan+tahun mulai–selesai) agar durasi dan resensi bisa dinilai. | Bukti STAR |
| R8 | **Skill relevan:** skill dikelompokkan, terbukti di pengalaman, dan sesuai posisi target; bukan daftar panjang tanpa bukti. | Skill Relevan |
| R9 | **Format & ATS:** satu kolom, font standar 10–12pt, tanpa tabel/kolom/gambar/ikon; file PDF/DOCX berisi teks (bukan hasil scan). | Format & ATS |
| R10 | **Kejujuran & relevansi:** tidak ada klaim, peran, atau angka yang tidak ada di pengalaman asli; isi disesuaikan dengan posisi yang dilamar. | Semua (konsistensi) |

## Cara pakai di sistem

- Skor standar (rule-based di `src/lib/analyze.ts`) sudah memakai sebagian besar
  rubrik ini (STAR, IPK/sertifikat, skill terbukti, format ATS).
- AI (`api/analyze-ai.ts`) wajib menilai berdasarkan rubrik ini dan menyebut
  kode rubrik (mis. `[R5]`) di tiap butir kekurangan, supaya pengguna tahu
  patokan mana yang dilanggar.
- AI tidak boleh menambah klaim di luar CV; angka yang tidak ada di CV ditulis
  sebagai placeholder `[X%]`/`[jumlah]` dan pengguna wajib mengisi angka aslinya.
- Bila CV tidak cocok dengan posisi target (tidak ada bukti sama sekali untuk
  posisi itu, atau posisi jauh di bawah level CV), AI harus mengatakannya jujur
  di awal saran, bukan hanya memberi semangat.
