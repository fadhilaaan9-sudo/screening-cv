// Uji logika penilaian berbasis bukti (STAR, 3 terbaik, dua skor).
// Jalankan: npx tsx scripts/run-tests.ts
import { analyzeCv, applyCap, detectCvLanguage, detectPhone, findPortfolio, rescaleScore } from '../src/lib/analyze'
import { canonicalizeSkill, findSkillsInText } from '../src/lib/skills'
import { detectRoleProfile, ROLE_PROFILES } from '../src/lib/roles'
import { SAMPLE_CV } from '../src/lib/sampleCv'

const MEDIUM_CV = `Budi Santoso
budi.santoso@gmail.com | 0812-9876-5432 | linkedin.com/in/budisantoso

Ringkasan
Saya lulusan baru yang tertarik di bidang administrasi dan data entry, terbiasa menggunakan komputer.

Pengalaman
Magang Administrasi — PT Sinar Abadi (2023)
- Membantu mengelola arsip dokumen perusahaan setiap hari.
- Membuat laporan sederhana untuk tim administrasi.
- Melayani pelanggan yang datang ke kantor.

Pendidikan
SMK Negeri 1 Jakarta — Jurusan Administrasi Perkantoran (2020 - 2023)

Keahlian
Microsoft Word, Microsoft Excel, Mengetik, Internet`

const WEAK_CV = `Andi Pratama
andi.pratama@gmail.com
Saya Andi. Saya pernah bekerja di toko pakaian selama dua tahun. Saya bisa mengoperasikan kasir dan melayani pembeli. Pendidikan terakhir SMA. Saya ingin segera bekerja dan dekat rumah.`

// Contoh A (dokumen desain): banyak kata, sedikit bukti.
const CV_A = `Rina Wijaya
rina.wijaya@gmail.com | 0812-3456-7890 | linkedin.com/in/rinawijaya

Ringkasan
Saya seorang lulusan baru yang meningkatkan kemampuan mengelola membangun mengembangkan menganalisis memimpin merancang mengotomatisasi mencapai dan menjual berbagai hal dengan sangat baik dan terukur setiap hari untuk mencapai target yang besar dan meningkatkan hasil kerja tim secara konsisten dan profesional dalam berbagai proyek dan kegiatan organisasi kampus yang saya ikuti dengan penuh semangat dan dedikasi tinggi selama masa kuliah saya yang penuh pengalaman berharga dan pembelajaran penting bagi masa depan karier saya.

Pengalaman
Saya pernah magang dan membantu pekerjaan kantor.

Pendidikan
Sarjana Manajemen — Universitas Gadjah Mada (2021 - 2025)
IPK 3,50 dari skala 4,00.

Keahlian
Microsoft Excel, SQL, Python, Power BI, Tableau, Google Sheets, SPSS, Looker Studio, Git, Bahasa Inggris`

// Contoh B (dokumen desain): fresh graduate, 2 bukti sangat kuat.
const CV_B = `Dewi Lestari
dewi.lestari@gmail.com | 0813-4567-8901 | linkedin.com/in/dewilestari | github.com/dewilestari
Jakarta, Indonesia

Ringkasan
Data Analyst lulusan baru yang menganalisis 1.000 data penjualan selama magang dan meningkatkan akurasi laporan 25% di PT Maju Bersama. Terbiasa membangun dashboard dan mengelola pipeline data untuk tim manajemen.

Magang
Magang Data Analyst — PT Maju Bersama (Jan - Jun 2024)
- Menganalisis 1.000 data penjualan dan meningkatkan akurasi laporan sebesar 25%.
- Mengelola pipeline data harian untuk 20 orang tim sehingga laporan selesai 2 hari lebih cepat.

Proyek
Proyek Dashboard Penjualan — Universitas Indonesia (2024)
- Membangun dashboard penjualan untuk 30 toko dan meningkatkan kecepatan laporan sebesar 40%.
- Mengembangkan script Python yang menghemat 10 jam kerja per minggu.

Pendidikan
Sarjana Statistika — Universitas Indonesia (2020 - 2024)
IPK 3,75 dari skala 4,00.

Keahlian
SQL, Python, Excel, Power BI, Dashboard, Analisis Data`

// Contoh C (dokumen desain): fresh graduate, 7 bukti, 3 sangat kuat.
const CV_C = `${CV_B}

Organisasi
Ketua Divisi Data — Himpunan Mahasiswa Statistika (2023)
- Memimpin tim 12 orang dan meningkatkan partisipasi anggota sebesar 35%.
- Mengelola database 500 anggota sehingga pendataan selesai 3 hari lebih cepat.

Proyek
Aplikasi Keuangan UMKM — Proyek Pribadi (2024)
- Membangun aplikasi pencatatan keuangan untuk 25 UMKM dan menghemat 8 jam kerja per minggu.

Survei Kepuasan — Proyek Kampus (2023)
- Menganalisis 2.000 data survei dan meningkatkan akurasi hasil sebesar 20%.

Dashboard Kehadiran — PT Contoh (2023)
- Membuat dashboard kehadiran untuk 100 karyawan dengan Excel dan Power BI.

Media Sosial Komunitas — Komunitas Data (2024)
- Mengelola media sosial komunitas dan meningkatkan pengikut sebesar 50% dalam 6 bulan.`

const FRESH_NO_EVIDENCE = `Sinta Maharani
sinta@gmail.com | 0812-1111-2222

Ringkasan
Lulusan baru yang rajin dan cepat belajar.

Pendidikan
Sarjana Akuntansi — Universitas Airlangga (2021 - 2025)

Keahlian
Microsoft Excel, Akuntansi`

const JOB_DATA_ANALYST = `Data Analyst dibutuhkan. Menguasai SQL, Python, dan dashboard. Menganalisis data penjualan, membuat laporan, dan membangun dashboard Power BI untuk tim manajemen.`

const JOB_ADMIN = `Staff Administrasi dibutuhkan. Mengelola arsip dan surat, data entry, mengetik dokumen, melayani pelanggan, dan membuat laporan administrasi dengan komputer.`

let failures = 0
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'LOLOS' : 'GAGAL'} — ${name}: ${detail}`)
  if (!ok) failures++
}

function aspectScore(result: ReturnType<typeof analyzeCv>, name: string): number {
  return result.aspects.find((a) => a.name === name)?.score ?? -1
}

// ---- CV contoh bawaan: kuat, tapi hanya 1 bukti kerja yang sempurna ----
const strong = analyzeCv(SAMPLE_CV, { mode: 'experienced' })
console.log('CV KUAT per aspek:', strong.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check(
  'CV kuat (contoh bawaan)',
  strong.readyScore >= 70 && strong.readyScore <= 84,
  `Skor Siap ${strong.readyScore}/100 (${strong.readyLabel})`,
)
check('CV kuat tanpa catatan pindah mode', strong.modeNote === null, String(strong.modeNote))

// Mode fresh untuk CV yang sama: ada kerja penuh waktu > 1 tahun.
const strongFresh = analyzeCv(SAMPLE_CV, { mode: 'fresh' })
check(
  'CV kuat mode fresh memberi catatan pindah mode',
  strongFresh.modeNote !== null,
  strongFresh.modeNote ?? '(tidak ada catatan)',
)

// ---- Menengah & lemah (uji lama, rentang disesuaikan rumus baru) ----
const medium = analyzeCv(MEDIUM_CV, { mode: 'fresh' })
console.log('CV MENENGAH per aspek:', medium.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check(
  'CV menengah realistis',
  medium.readyScore >= 35 && medium.readyScore <= 55,
  `Skor Siap ${medium.readyScore}/100 (${medium.readyLabel})`,
)

const weak = analyzeCv(WEAK_CV, { mode: 'fresh' })
console.log('CV LEMAH per aspek:', weak.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check('CV lemah', weak.readyScore <= 30, `Skor Siap ${weak.readyScore}/100 (${weak.readyLabel})`)

// ---- Ujian desain: A < B < C ----
const a = analyzeCv(CV_A, { mode: 'fresh' })
const b = analyzeCv(CV_B, { mode: 'fresh' })
const c = analyzeCv(CV_C, { mode: 'fresh' })
console.log(`Contoh A: ${a.readyScore} | B: ${b.readyScore} | C: ${c.readyScore}`)
check('Contoh A (banyak kata, sedikit bukti) rendah', a.readyScore < 50, `Skor Siap ${a.readyScore}`)
check('Contoh B (2 bukti kuat) di atas A', b.readyScore > a.readyScore, `B ${b.readyScore} > A ${a.readyScore}`)
check('Contoh B label minimal Sudah Bagus', b.readyScore >= 70, `Skor Siap ${b.readyScore} (${b.readyLabel})`)
check('Contoh C (7 bukti) di atas B', c.readyScore > b.readyScore, `C ${c.readyScore} > B ${b.readyScore}`)
check('Contoh C label Sangat Siap', c.readyScore >= 85, `Skor Siap ${c.readyScore} (${c.readyLabel})`)
check(
  'Contoh C bukti STAR 30/30 dari 3 terbaik',
  aspectScore(c, 'Bukti STAR') === 30,
  `Bukti STAR ${aspectScore(c, 'Bukti STAR')}/30`,
)
check(
  'Contoh C bukti ke-4+ masuk Kekuatan, bukan poin',
  c.extraEvidence.length === 4,
  `${c.extraEvidence.length} bukti cadangan`,
)
check(
  'Contoh B bukti STAR 20/30 (2 dari 3 slot)',
  aspectScore(b, 'Bukti STAR') === 20,
  `Bukti STAR ${aspectScore(b, 'Bukti STAR')}/30`,
)

// CV Inggris — isi sama dengan Contoh B, bahasa Inggris.
// Skornya harus setara B; semua pesan hasil tetap Bahasa Indonesia.
const ENGLISH_CV = `Sarah Johnson
sarah.johnson@gmail.com | 0813-4567-8901 | linkedin.com/in/sarahjohnson | github.com/sarahjohnson
Jakarta, Indonesia

Summary
Fresh graduate Data Analyst who analyzed 1,000 sales records during internship and improved report accuracy by 25% at PT Maju Bersama. Experienced in building dashboards and managing data pipelines for the management team.

Internship
Data Analyst Intern — PT Maju Bersama (Jan - Jun 2024)
- Analyzed 1,000 sales records and improved report accuracy by 25%.
- Managed daily data pipelines for a team of 20 people so reports finished 2 days faster.

Project
Sales Dashboard Project — University of Indonesia (2024)
- Built a sales dashboard for 30 stores and increased report speed by 40%.
- Developed a Python script that saved 10 hours of work per week.

Education
Bachelor of Statistics — University of Indonesia (2020 - 2024)
GPA 3.75 out of 4.00.

Skills
SQL, Python, Excel, Power BI, Dashboard, Data Analysis`

// ---- CV Inggris: skor setara CV Indonesia yang isinya sama (CV_B) ----
const englishCv = analyzeCv(ENGLISH_CV, { mode: 'fresh' })
console.log('CV INGGRIS per aspek:', englishCv.aspects.map((a) => `${a.name} ${a.score}/${a.max}`).join(' | '))
check('CV Inggris terdeteksi bahasanya en', englishCv.cvLanguage === 'en', `cvLanguage ${englishCv.cvLanguage}`)
check('CV Indonesia (B) terdeteksi bahasanya id', b.cvLanguage === 'id', `cvLanguage ${b.cvLanguage}`)
check('Deteksi bahasa langsung: Inggris', detectCvLanguage(ENGLISH_CV) === 'en', detectCvLanguage(ENGLISH_CV))
check('Deteksi bahasa langsung: Indonesia', detectCvLanguage(CV_B) === 'id', detectCvLanguage(CV_B))
check(
  'CV Inggris skor setara CV Indonesia B',
  englishCv.readyScore >= 70 && englishCv.readyScore <= 84,
  `Skor Siap ${englishCv.readyScore}/100 (${englishCv.readyLabel})`,
)
check(
  'CV Inggris skill terbukti sama seperti B (heading Skills jamak)',
  aspectScore(englishCv, 'Skill Relevan') >= 7,
  `Skill Relevan ${aspectScore(englishCv, 'Skill Relevan')}/15`,
)
check(
  'CV Inggris struktur terdeteksi penuh (Skills jamak)',
  aspectScore(englishCv, 'Format & ATS') >= 11,
  `Format & ATS ${aspectScore(englishCv, 'Format & ATS')}/15`,
)
check(
  'CV Inggris bukti STAR 20/30 (2 dari 3 slot)',
  aspectScore(englishCv, 'Bukti STAR') === 20,
  `Bukti STAR ${aspectScore(englishCv, 'Bukti STAR')}/30`,
)
check(
  'CV Inggris pendidikan terdeteksi (University + GPA)',
  aspectScore(englishCv, 'Pendidikan & Belajar') >= 12,
  `Pendidikan & Belajar ${aspectScore(englishCv, 'Pendidikan & Belajar')}/15`,
)

// ---- Fresh graduate tanpa bukti sama sekali ----
const noEvidence = analyzeCv(FRESH_NO_EVIDENCE, { mode: 'fresh' })
check(
  'Fresh graduate 0 bukti: Bukti STAR 0',
  aspectScore(noEvidence, 'Bukti STAR') === 0,
  `Bukti STAR ${aspectScore(noEvidence, 'Bukti STAR')}/30`,
)
check(
  'Fresh graduate 0 bukti: skor di bawah 50',
  noEvidence.readyScore < 50,
  `Skor Siap ${noEvidence.readyScore}`,
)

// ---- Anti-akali: menempel kata aksi + angka di ringkasan tidak mengubah Bukti ----
const stuffed = MEDIUM_CV.replace(
  'Saya lulusan baru yang tertarik di bidang administrasi dan data entry, terbiasa menggunakan komputer.',
  'Saya lulusan baru yang meningkatkan mengelola membangun mengembangkan menganalisis memimpin 30% 50 orang Rp 100 juta di bidang administrasi dan data entry, terbiasa menggunakan komputer.',
)
const mediumStuffed = analyzeCv(stuffed, { mode: 'fresh' })
check(
  'Tempelan kata di ringkasan tidak mengubah poin Bukti',
  aspectScore(mediumStuffed, 'Bukti STAR') === aspectScore(medium, 'Bukti STAR'),
  `Bukti STAR tetap ${aspectScore(mediumStuffed, 'Bukti STAR')}/30`,
)

// ---- Dua skor: Skor Cocok berubah menurut lowongan, Skor Siap tetap ----
const da = analyzeCv(SAMPLE_CV, { mode: 'experienced', targetRole: 'Data Analyst', jobDesc: JOB_DATA_ANALYST })
const admin = analyzeCv(SAMPLE_CV, { mode: 'experienced', targetRole: 'Staff Administrasi', jobDesc: JOB_ADMIN })
console.log(`Skor Siap ${da.readyScore} | Cocok Data Analyst ${da.matchScore} | Cocok Admin ${admin.matchScore}`)
check(
  'Skor Cocok Data Analyst lebih tinggi dari Admin untuk CV data',
  (da.matchScore ?? 0) > (admin.matchScore ?? 0),
  `DA ${da.matchScore} > Admin ${admin.matchScore}`,
)
check('Skor Cocok tidak pernah di atas 95', (da.matchScore ?? 0) <= 95 && (admin.matchScore ?? 0) <= 95, 'plafon 95')
check(
  'SQL hanya klaim (di skill, bukan di bukti) untuk lowongan Data Analyst',
  da.keywords?.inCvOnly.includes('sql') === true,
  `hanya klaim: ${da.keywords?.inCvOnly.join(', ')}`,
)
const noJob = analyzeCv(SAMPLE_CV, { mode: 'experienced' })
check('Tanpa lowongan, Skor Cocok null', noJob.matchScore === null, String(noJob.matchScore))

// ---- Plafon realistis 95 ----
check('Plafon: 100 -> 95', applyCap(100) === 95, String(applyCap(100)))
check('Plafon: 96 -> 95', applyCap(96) === 95, String(applyCap(96)))
check('Plafon: 50 tetap 50', applyCap(50) === 50, String(applyCap(50)))

// ---- Uji lama yang masih valid ----
check('HP format kurung "(62 8 ) 95 - 6031 - 48022"', detectPhone('(62 8 ) 95 - 6031 - 48022') === true, 'harus true')
check('HP rentang tahun "2022 - 2024"', detectPhone('Bekerja tahun 2022 - 2024 di Jakarta') === false, 'harus false')
check('HP telepon kantor "021-5551234"', detectPhone('Telepon kantor 021-5551234') === false, 'harus false')
check('Portofolio github.com terdeteksi', findPortfolio('github.com/Fakhriaja07') !== null, String(findPortfolio('github.com/Fakhriaja07')))
check('Kata "portofolio" tanpa alamat', findPortfolio('Saya punya portofolio yang bagus') === null, 'harus null')

// ---- Rubrik per peran + skill semantik (2026-11-19) ----

check(
  'Bobot tiap profil peran total 100',
  ROLE_PROFILES.every((p) => Object.values(p.weights).reduce((s, w) => s + w, 0) === 100),
  ROLE_PROFILES.map((p) => `${p.label}=${Object.values(p.weights).reduce((s, w) => s + w, 0)}`).join(', '),
)

check(
  'CV contoh tanpa peran tetap 72 di Umum',
  strong.readyScore === 72 && strong.roleProfile.id === 'umum',
  `Skor Siap ${strong.readyScore} (${strong.roleProfile.label})`,
)

const strongDa = analyzeCv(SAMPLE_CV, { mode: 'experienced', targetRole: 'Data Analyst' })
const strongDev = analyzeCv(SAMPLE_CV, { mode: 'experienced', targetRole: 'Software Developer' })
check(
  'Profil Data Analyst terdeteksi dari posisi target',
  strongDa.roleProfile.id === 'data-analyst',
  `${strongDa.roleProfile.label} — ${strongDa.roleProfile.reason}`,
)
check(
  'CV sama, profil beda -> skor beda',
  strongDa.readyScore !== strongDev.readyScore,
  `DA ${strongDa.readyScore} vs Developer ${strongDev.readyScore}`,
)
check(
  'CV contoh peran Data Analyst: Skill 8,5/20 dan total 69',
  aspectScore(strongDa, 'Skill Relevan') === 8.5 && strongDa.readyScore === 69,
  `Skill ${aspectScore(strongDa, 'Skill Relevan')}/20, Skor Siap ${strongDa.readyScore}`,
)
check(
  'Profil manual (roleProfileId) mengalahkan deteksi otomatis',
  analyzeCv(SAMPLE_CV, { mode: 'experienced', targetRole: 'Data Analyst', roleProfileId: 'akuntan' })
    .roleProfile.id === 'akuntan',
  'roleProfileId akuntan dipakai',
)
check(
  'Peran tak dikenal -> profil Umum',
  detectRoleProfile('Kepala Desa').profile.id === 'umum',
  detectRoleProfile('Kepala Desa').profile.label,
)

check('MySQL membuktikan SQL', canonicalizeSkill('MySQL').includes('sql'), canonicalizeSkill('MySQL').join(', '))
check(
  'pandas membuktikan Python',
  findSkillsInText('Mengolah data dengan pandas setiap hari').has('python'),
  'python terbukti',
)
check(
  'Implikasi satu tingkat: pandas -> Python, Python TIDAK -> Django',
  findSkillsInText('Mengolah data dengan pandas').has('python') &&
    !findSkillsInText('Menulis script Python untuk otomasi').has('django'),
  'pandas->python ya; python->django tidak',
)
check(
  'Excel + Google Sheets = 1 skill kanonik',
  canonicalizeSkill('Google Sheets').includes('excel') &&
    canonicalizeSkill('Microsoft Excel').includes('excel'),
  'keduanya -> excel',
)
check(
  'Akronim aman: IT dan C tidak membuktikan skill apa pun',
  canonicalizeSkill('IT').length === 0 && findSkillsInText('Staff IT Support di perusahaan').size === 0 &&
    !findSkillsInText('Nilai C untuk mata kuliah').has('c-sharp'),
  'tidak ada false positive',
)
check(
  "C Sharp (ditulis lengkap) membuktikan C#",
  canonicalizeSkill('C Sharp').includes('c-sharp'),
  canonicalizeSkill('C Sharp').join(', '),
)
check(
  'Rescale: fraksi 0,5 ke bobot 25 = 12,5',
  rescaleScore(0.5, 25) === 12.5,
  String(rescaleScore(0.5, 25)),
)

if (failures > 0) {
  console.error(`\n${failures} uji GAGAL`)
  process.exit(1)
}
console.log('\nSemua uji lolos.')
