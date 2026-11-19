// Logika penilaian CV berbasis bukti (rule-based), 100% berjalan di browser.
// Prinsip: nilai bukti, bukan kata. Satu bukti = satu pengalaman, magang,
// proyek, organisasi, tugas akhir, atau freelance yang dinilai STAR:
// Peran, Periode, Aksi, Hasil. Hanya 3 bukti terbaik yang dihitung.
// Total mentah 100 poin, ditampilkan dengan plafon realistis 95.

// ---------- Bahasa CV ----------
// Skor memakai kamus bahasa CV-nya (Indonesia / Inggris).
// Semua pesan hasil TETAP Bahasa Indonesia - bahasa hanya memilih kamus,
// bukan bahasa hasil.
export type CvLanguage = 'id' | 'en'

const ID_MARKERS = [
  'yang', 'dan', 'dengan', 'saya', 'lulusan', 'pengalaman', 'pendidikan',
  'keahlian', 'magang', 'proyek', 'mengelola', 'membangun', 'universitas',
  'perusahaan', 'selama', 'untuk', 'dalam', 'adalah',
]
const EN_MARKERS = [
  'the', 'and', 'with', 'experience', 'education', 'skills', 'internship',
  'project', 'managed', 'developed', 'increased', 'university', 'company',
  'years', 'team', 'results', 'responsible',
]

/** Tebak bahasa utama CV dari kata penanda. Default: Indonesia. */
export function detectCvLanguage(text: string): CvLanguage {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/))
  const count = (markers: string[]) => markers.filter((w) => words.has(w)).length
  return count(EN_MARKERS) > count(ID_MARKERS) ? 'en' : 'id'
}

export type CandidateMode = 'fresh' | 'experienced'

export type CheckStatus = 'baik' | 'kurang' | 'buruk'

export interface CheckItem {
  id: string
  aspect: string
  title: string
  score: number
  max: number
  status: CheckStatus
  // Wajib format "angka + alasan": contoh "24/30 - tiga buktimu punya
  // aksi dan hasil yang jelas; kurang 6 karena dua bukti belum ada periode."
  message: string
}

export interface AspectResult {
  name: string
  score: number
  max: number
  checks: CheckItem[]
}

export type EvidenceSource =
  | 'kerja'
  | 'magang'
  | 'proyek'
  | 'organisasi'
  | 'tugas-akhir'
  | 'freelance'
  | 'volunteer'

export interface Evidence {
  title: string
  source: EvidenceSource
  text: string
  // Baris isi entri (sudah tanpa penanda bullet) - dipakai Playground untuk diedit.
  bullets: string[]
  // Nilai STAR 0-10: Peran 2,5 / Periode 2,5 / Aksi 2,5 / Hasil 2,5.
  roleScore: number
  periodScore: number
  actionScore: number
  resultScore: number
  score: number
  reasons: string[]
}

export interface KeywordResult {
  // Persen kata kunci yang ditemukan DI DALAM bukti (bukan sekadar di CV).
  percent: number
  found: string[]
  missing: string[]
  total: number
  inEvidence: string[]
  inCvOnly: string[]
}

export interface AnalysisResult {
  // Skor Siap (capped 95). `total` dan `label` dipertahankan untuk kompatibilitas.
  total: number
  label: string
  readyScore: number
  readyLabel: string
  rawTotal: number
  // Skor Cocok: null bila user tidak mengisi posisi target / deskripsi lowongan.
  matchScore: number | null
  matchLabel: string | null
  mode: CandidateMode
  // Bahasa utama CV ('id' / 'en') — dipakai memilih kamus, hasil tetap Indonesia.
  cvLanguage: CvLanguage
  aspects: AspectResult[]
  strengths: CheckItem[]
  priorities: CheckItem[]
  topEvidence: Evidence[]
  extraEvidence: Evidence[]
  // Semua bukti, urut skor tertinggi dulu - dipakai Playground untuk misi terlemah.
  allEvidence: Evidence[]
  keywords: KeywordResult | null
  roleWarning: string | null
  modeNote: string | null
  consistencyWarnings: string[]
  portfolioUrl: string | null
  wordCount: number
}

export interface AnalyzeOptions {
  targetRole?: string
  jobDesc?: string
  mode?: CandidateMode
}

export const MAX_DISPLAY_SCORE = 95

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function labelFor(score: number): string {
  if (score >= 85) return 'Sangat Siap Dilamar'
  if (score >= 70) return 'Sudah Bagus'
  if (score >= 50) return 'Perlu Perbaikan'
  return 'Perlu Dirombak Dulu'
}

/** Plafon realistis: total mentah 96-100 ditampilkan sebagai 95. */
export function applyCap(raw: number): number {
  return Math.min(MAX_DISPLAY_SCORE, Math.max(0, Math.round(raw)))
}

function statusOf(score: number, max: number): CheckStatus {
  if (score >= max) return 'baik'
  if (score <= 0) return 'buruk'
  return 'kurang'
}

function makeCheck(
  id: string,
  aspect: string,
  title: string,
  score: number,
  max: number,
  message: string,
): CheckItem {
  return { id, aspect, title, score, max, status: statusOf(score, max), message }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(text)
}

// ---------- Deteksi nomor HP Indonesia ----------

export function findPhone(text: string): string | null {
  const candidates = text.match(/\+?\(?\d[\d\s().-]{6,}\d/g) ?? []
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, '')
    // 08xx: total 10-14 digit
    if (/^08\d{8,12}$/.test(digits)) return candidate.trim()
    // 628xx: total 11-15 digit
    if (/^628\d{8,12}$/.test(digits)) return candidate.trim()
  }
  return null
}

export function detectPhone(text: string): boolean {
  return findPhone(text) !== null
}

// ---------- Deteksi link karya / portofolio ----------

const PORTFOLIO_DOMAINS = [
  'github.com',
  'gitlab.com',
  'behance.net',
  'dribbble.com',
  'kaggle.com',
  'bitbucket.org',
  'codepen.io',
  'artstation.com',
  'notion.site',
  'notion.so',
]

const PORTFOLIO_SUFFIXES = ['.vercel.app', '.netlify.app', '.github.io']

const URL_PATTERN =
  /(https?:\/\/[^\s,;<>)\]]+|www\.[^\s,;<>)\]]+|[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?(?:\/[\w\-./#?=&%+]*)?)/gi

function domainOf(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase()
}

export function findPortfolio(text: string): string | null {
  // 1) URL pada domain portofolio yang dikenal, di mana pun di CV.
  const urls = text.match(URL_PATTERN) ?? []
  for (const raw of urls) {
    const clean = raw.replace(/[.)]+$/, '')
    const domain = domainOf(clean)
    const known =
      PORTFOLIO_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d)) ||
      PORTFOLIO_SUFFIXES.some((s) => domain.endsWith(s))
    if (known) return clean
  }
  // 2) URL apa pun pada baris berlabel "portofolio"/"portfolio"/"karya".
  for (const line of text.split('\n')) {
    if (/portofolio|portfolio|karya/i.test(line)) {
      const labeled = line.match(URL_PATTERN) ?? []
      for (const raw of labeled) {
        const clean = raw.replace(/[.)]+$/, '')
        // Hindari menangkap kata "portofolio" itu sendiri atau domain tanpa TLD jelas.
        if (domainOf(clean).includes('.')) return clean
      }
    }
  }
  return null
}

// Domisili: nama kota besar Indonesia atau ", Indonesia" di baris awal CV.
const DOMICILE_WORDS = [
  'jakarta', 'bandung', 'surabaya', 'medan', 'makassar', 'semarang',
  'palembang', 'pekanbaru', 'yogyakarta', 'jogja', 'bekasi', 'tangerang',
  'depok', 'bogor', 'malang', 'denpasar', 'balikpapan', 'batam', 'padang',
  'bandar lampung', 'indonesia',
]

function findDomicile(text: string): boolean {
  const head = text.split('\n').slice(0, 8).join(' ').toLowerCase()
  return DOMICILE_WORDS.some((w) => head.includes(w))
}

// ---------- Pemecah bagian (section) berdasarkan heading ----------
// Heading dikenali secara ketat: baris pendek yang DIAWALI kata heading.
// Kalimat biasa seperti "Saya pernah magang..." tidak lagi salah jadi heading.

const SECTION_HEADINGS: { kind: string; words: string[] }[] = [
  { kind: 'ringkasan', words: ['ringkasan', 'tentang saya', 'profil', 'summary', 'professional summary', 'profile', 'objective'] },
  { kind: 'pengalaman', words: ['pengalaman kerja', 'pengalaman', 'experience', 'experiences', 'work experience', 'professional experience', 'employment history', 'pekerjaan', 'work history', 'riwayat kerja'] },
  { kind: 'magang', words: ['magang', 'internship', 'internships', 'praktik kerja', 'pkl'] },
  { kind: 'proyek', words: ['proyek', 'project', 'projects', 'portofolio proyek'] },
  { kind: 'organisasi', words: ['organisasi', 'organization', 'organizations', 'kepanitiaan', 'pengalaman organisasi'] },
  { kind: 'tugas-akhir', words: ['tugas akhir', 'skripsi', 'thesis', 'penelitian'] },
  { kind: 'freelance', words: ['freelance', 'pekerjaan lepas', 'freelancer'] },
  { kind: 'volunteer', words: ['volunteer', 'volunteers', 'volunteer experience', 'relawan', 'kesukarelawanan'] },
  { kind: 'pendidikan', words: ['pendidikan', 'education', 'riwayat pendidikan'] },
  { kind: 'keahlian', words: ['keahlian', 'skill', 'skills', 'technical skills', 'skills & tools', 'kemampuan', 'kompetensi', 'tools', 'teknologi'] },
  { kind: 'sertifikasi', words: ['sertifikasi', 'sertifikat', 'certification', 'certifications', 'certificate', 'certificates', 'course', 'courses', 'training', 'trainings', 'certified', 'kursus', 'pelatihan', 'bootcamp'] },
  { kind: 'kontak', words: ['kontak', 'contact'] },
]

function headingKind(line: string): string | null {
  const t = line.trim().toLowerCase().replace(/:$/, '')
  if (t.length === 0 || t.length > 50) return null
  // Judul entri bukti ("Magang Data Analyst — PT X (2024)") bukan heading:
  // heading bagian tidak pernah berisi pemisah "—" atau tahun.
  if (/—|–/.test(t) || /\b(19|20)\d{2}\b/.test(t)) return null
  // Bentuk jamak diperlakukan sama dengan tunggalnya ('Skills' -> 'skill',
  // 'Projects' -> 'project'). Varian asli tetap dicek, jadi tidak ada yang hilang.
  const firstWord = t.split(' ')[0] ?? ''
  const singularFirst =
    firstWord.length > 3 && firstWord.endsWith('s') ? firstWord.slice(0, -1) : firstWord
  const singular = singularFirst === firstWord ? t : t.replace(firstWord, singularFirst)
  const variants = singular === t ? [t] : [t, singular]
  for (const section of SECTION_HEADINGS) {
    for (const w of section.words) {
      for (const v of variants) {
        if (v === w || v.startsWith(w + ' ') || v.startsWith(w + ' —') || v.startsWith(w + ' -')) {
          return section.kind
        }
      }
    }
  }
  return null
}

interface Section {
  kind: string
  lines: string[]
}

function splitSections(text: string): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  for (const line of text.split('\n')) {
    const kind = headingKind(line)
    if (kind) {
      current = { kind, lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  return sections
}

function getSectionText(sections: Section[], kinds: string[]): string {
  return sections
    .filter((s) => kinds.includes(s.kind))
    .map((s) => s.lines.join('\n'))
    .join('\n')
    .trim()
}

// ---------- Kata kerja aksi & hasil terukur (hanya di dalam bukti) ----------

const ACTION_VERBS = [
  'meningkatkan', 'mengelola', 'membangun', 'mengembangkan', 'menganalisis',
  'memimpin', 'merancang', 'mengotomatisasi', 'mencapai', 'menurunkan',
  'menghemat', 'membuat', 'menjual', 'melatih', 'menyusun', 'mengolah',
  'menerapkan', 'memperbaiki', 'menyelesaikan', 'mengkoordinasikan',
  'increased', 'managed', 'developed', 'built', 'led', 'created',
  'improved', 'analyzed', 'designed', 'automated', 'reduced', 'delivered',
  'implemented', 'launched', 'coordinated', 'optimized', 'achieved',
  'supervised', 'trained', 'presented', 'resolved', 'streamlined',
]

const WEAK_VERBS = [
  'membantu', 'melakukan', 'mengerjakan', 'bertugas', 'mengikuti', 'mendukung',
  'assisted', 'helped', 'performed', 'worked', 'participated', 'supported',
]

function countActionVerbs(text: string): number {
  const lower = text.toLowerCase()
  let found = 0
  for (const verb of ACTION_VERBS) {
    if (new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i').test(lower)) found++
  }
  return found
}

function hasWeakVerbOnly(text: string): boolean {
  const lower = text.toLowerCase()
  return WEAK_VERBS.some((v) => new RegExp(`\\b${escapeRegExp(v)}\\b`, 'i').test(lower))
}

function countMeasurableResults(text: string): number {
  let t = text
  // Buang rangkaian mirip nomor HP/telepon agar digitnya tidak terhitung.
  t = t.replace(/\+?\(?\d[\d\s().-]{6,}\d/g, ' ')
  // Buang tahun kalender 19xx/20xx (termasuk rentang tahun).
  t = t.replace(/\b(19|20)\d{2}\b/g, ' ')
  // Nominal Rp dihitung sekali, lalu dibuang agar tidak terhitung ganda via satuan.
  const rpMatches = t.match(/rp\s*\d[\d.,]*/gi) ?? []
  t = t.replace(/rp\s*\d[\d.,]*/gi, ' ')
  const unitMatches =
    t.match(/\d+(?:[.,]\d+)?\s*(%|juta|ribu|orang|klien|proyek|jam|hari|bulan|tahun|people|users?|clients?|customers?|projects?|hours?|days?|months?|years?|teams?|members?|stores?|dollars?|usd)/gi) ?? []
  const dollarMatches = t.match(/\$\s*\d[\d.,]*/gi) ?? []
  t = t.replace(/\$\s*\d[\d.,]*/gi, ' ')
  return rpMatches.length + dollarMatches.length + unitMatches.length
}

function extractYears(text: string): number[] {
  return (text.match(/\b(19|20)\d{2}\b/g) ?? []).map((y) => parseInt(y, 10))
}

// ---------- Pemecah entri bukti & penilaian STAR ----------

const EVIDENCE_KINDS: Record<string, EvidenceSource> = {
  pengalaman: 'kerja',
  magang: 'magang',
  proyek: 'proyek',
  organisasi: 'organisasi',
  'tugas-akhir': 'tugas-akhir',
  freelance: 'freelance',
  volunteer: 'volunteer',
}

function isBulletLine(line: string): boolean {
  return /^\s*([\-•*]|\d+[.)])\s+/.test(line)
}

function cleanBullet(line: string): string {
  return line.replace(/^\s*([\-•*]|\d+[.)])\s+/, '').trim()
}

// Baris judul entri: ada pemisah peran-tempat ("—") atau ada tahun,
// atau baris pendek tanpa titik yang menyebut tempat (PT / Universitas / ...).
function looksLikeEntryHeader(line: string): boolean {
  const t = line.trim()
  if (t.length === 0 || t.length > 90 || isBulletLine(t)) return false
  if (/—|–|\s-\s/.test(t)) return true
  if (/\b(19|20)\d{2}\b/.test(t)) return true
  if (!t.endsWith('.') && t.length <= 70 && /\b(PT|CV|Universitas|Institut|Sekolah|Organisasi|Komunitas|Himpunan|University|College|Organization|Community)\b/.test(t)) {
    return true
  }
  return false
}

interface RawEntry {
  header: string
  bodyLines: string[]
  source: EvidenceSource
}

/** Pecah satu bagian bukti menjadi entri-entri (satu entri = satu pengalaman/proyek). */
function splitEntries(lines: string[], source: EvidenceSource): RawEntry[] {
  const entries: RawEntry[] = []
  let current: RawEntry | null = null
  const flush = () => {
    if (current && (current.header || current.bodyLines.length > 0)) entries.push(current)
    current = null
  }
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (isBulletLine(line)) {
      if (!current) current = { header: '', bodyLines: [], source }
      current.bodyLines.push(cleanBullet(line))
    } else if (looksLikeEntryHeader(line)) {
      // Judul baru: entri sebelumnya selesai, kecuali entri saat ini belum punya judul.
      if (current && current.header) flush()
      if (!current) current = { header: '', bodyLines: [], source }
      if (!current.header) current.header = line
      else current.bodyLines.push(line)
    } else {
      if (!current) current = { header: '', bodyLines: [], source }
      current.bodyLines.push(line)
    }
  }
  flush()
  return entries
}

function entryKey(entry: RawEntry): string {
  const text = `${entry.header} ${entry.bodyLines.join(' ')}`.toLowerCase()
  const years = extractYears(text).join('-')
  const place = entry.header.split(/—|–|-/)[1]?.trim() ?? ''
  return `${place}|${years}|${text.slice(0, 40)}`.replace(/\s+/g, ' ').trim()
}

/** Nilai satu bukti dengan STAR. Tiap unsur 2,5 poin; unsur yang lemah dapat separuh. */
export function scoreEvidence(entry: RawEntry): Evidence {
  const text = [entry.header, ...entry.bodyLines].join('\n').trim()
  const reasons: string[] = []

  // P - Peran: judul memisahkan peran dan tempat ("Data Analyst — PT X").
  let roleScore = 0
  const parts = entry.header.split(/—|–|\s+-\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) roleScore = 2.5
  else if (entry.header) roleScore = 1.25
  if (roleScore < 2.5) reasons.push('peran atau tempatnya belum jelas')

  // T - Periode: ada tahun (satu tahun saja sudah cukup).
  const years = extractYears(text)
  let periodScore = 0
  if (years.length > 0) periodScore = 2.5
  else if (/sekarang|saat ini|present/i.test(text)) periodScore = 1.25
  if (periodScore < 2.5) reasons.push('belum ada periode/tahun')

  // A - Aksi: kata kerja kuat di DALAM bukti ini (bukan di ringkasan).
  const verbCount = countActionVerbs(text)
  let actionScore = 0
  if (verbCount >= 1) actionScore = 2.5
  else if (hasWeakVerbOnly(text)) actionScore = 1.25
  if (actionScore < 2.5) {
    reasons.push(actionScore === 0 ? 'belum ada kata kerja aksi' : 'kata kerjanya masih lemah (mis. "membantu")')
  }

  // H - Hasil: angka terukur di DALAM bukti ini.
  const resultCount = countMeasurableResults(text)
  let resultScore = 0
  if (resultCount >= 2) resultScore = 2.5
  else if (resultCount === 1) resultScore = 1.25
  if (resultScore < 2.5) reasons.push('belum ada hasil terukur (angka)')

  const score = roleScore + periodScore + actionScore + resultScore
  const title = entry.header || text.split('\n')[0]?.slice(0, 80) || '(tanpa judul)'
  return {
    title,
    source: entry.source,
    text,
    bullets: entry.bodyLines,
    roleScore,
    periodScore,
    actionScore,
    resultScore,
    score,
    reasons,
  }
}

/** Kumpulkan semua bukti dari semua bagian bukti, tanpa duplikat. */
export function extractEvidence(text: string): Evidence[] {
  const sections = splitSections(text)
  const raw: RawEntry[] = []
  for (const section of sections) {
    const source = EVIDENCE_KINDS[section.kind]
    if (!source) continue
    raw.push(...splitEntries(section.lines, source))
  }
  // Duplikat: bukti yang sama ditulis di dua tempat dihitung satu kali.
  const seen = new Map<string, RawEntry>()
  for (const entry of raw) {
    const key = entryKey(entry)
    const prev = seen.get(key)
    if (!prev || entry.bodyLines.join(' ').length > prev.bodyLines.join(' ').length) {
      seen.set(key, entry)
    }
  }
  return [...seen.values()].map(scoreEvidence)
}

// ---------- Kata kunci lowongan ----------

const STOPWORDS = new Set([
  // Bahasa Indonesia
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'adalah', 'ini', 'itu',
  'atau', 'serta', 'dalam', 'pada', 'sebagai', 'juga', 'akan', 'tidak', 'bisa',
  'dapat', 'harus', 'memiliki', 'selama', 'antara', 'tentang', 'oleh', 'kami',
  'kita', 'anda', 'saya', 'mereka', 'setelah', 'sebelum', 'lebih', 'sangat',
  'baik', 'baru', 'lain', 'bekerja', 'kerja', 'minimal', 'maksimal', 'tahun',
  'bulan', 'hari', 'orang', 'tim', 'perusahaan', 'bidang', 'posisi', 'sudah',
  'agar', 'saat', 'secara', 'menjadi', 'melakukan', 'memastikan', 'membantu',
  // English
  'the', 'and', 'for', 'with', 'our', 'you', 'are', 'will', 'have', 'has',
  'from', 'this', 'that', 'who', 'can', 'all', 'any', 'per', 'including',
  'work', 'working', 'experience', 'years', 'year', 'job', 'role', 'team',
  'able', 'strong', 'skills', 'skill', 'knowledge', 'using', 'use', 'etc',
])

function extractJobKeywords(
  jobDesc: string,
  cvLower: string,
  evidenceLower: string,
): KeywordResult {
  const words = jobDesc.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []
  const freq = new Map<string, number>()
  for (const w of words) {
    const clean = w.replace(/^[.-]+|[.-]+$/g, '')
    if (clean.length <= 2 || STOPWORDS.has(clean)) continue
    freq.set(clean, (freq.get(clean) ?? 0) + 1)
  }
  const selected = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 18)
    .map(([w]) => w)
  const inEvidence: string[] = []
  const inCvOnly: string[] = []
  const missing: string[] = []
  for (const kw of selected) {
    const pattern = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i')
    if (pattern.test(evidenceLower)) inEvidence.push(kw)
    else if (pattern.test(cvLower)) inCvOnly.push(kw)
    else missing.push(kw)
  }
  return {
    percent: selected.length ? Math.round((inEvidence.length / selected.length) * 100) : 0,
    found: [...inEvidence, ...inCvOnly],
    missing,
    total: selected.length,
    inEvidence,
    inCvOnly,
  }
}

// Kata peran/jabatan umum, dipakai bila user tidak mengisi posisi target.
const ROLE_WORDS = [
  'analyst', 'analis', 'developer', 'programmer', 'engineer', 'desainer', 'designer',
  'administrasi', 'admin', 'marketing', 'akuntan', 'accountant', 'guru', 'perawat',
  'dokter', 'kasir', 'manager', 'manajer', 'staff', 'staf', 'operator', 'teknisi',
  'penulis', 'jurnalis', 'arsitek', 'apoteker', 'auditor', 'konsultan', 'sales',
  'customer', 'service', 'data', 'keuangan', 'finance', 'hrd', 'logistik', 'produksi',
]

/** Kata-kata penting dari posisi target (kata pendek dan kata umum dibuang). */
function significantRoleWords(role: string): string[] {
  return role
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

// Sinonim skill yang searti digabung jadi satu (anti-duplikat).
const SKILL_SYNONYMS: Record<string, string> = {
  'microsoft excel': 'excel',
  'ms excel': 'excel',
  'microsoft word': 'word',
  'ms word': 'word',
  'microsoft powerpoint': 'powerpoint',
  'ms powerpoint': 'powerpoint',
  powerbi: 'power bi',
  'bahasa inggris': 'inggris',
  'english': 'inggris',
}

function normalizeSkill(raw: string): string {
  const s = raw.toLowerCase().replace(/^\s*[-*]\s*/, '').trim()
  return SKILL_SYNONYMS[s] ?? s
}

function parseSkillItems(sectionText: string): string[] {
  if (!sectionText) return []
  const items = sectionText
    .split(/[\n,;•·|]+/)
    .map((s) => normalizeSkill(s))
    .filter((s) => s.length >= 2)
  return [...new Set(items)]
}

// ---------- Fungsi analisis utama ----------

export function analyzeCv(rawText: string, options: AnalyzeOptions = {}): AnalysisResult {
  const text = rawText ?? ''
  const lower = text.toLowerCase()
  const cvLanguage = detectCvLanguage(text)
  const totalWords = countWords(text)
  const mode: CandidateMode = options.mode ?? 'fresh'
  const sections = splitSections(text)
  const evidence = extractEvidence(text)
  const evidenceText = evidence.map((e) => e.text).join('\n')
  const evidenceLower = evidenceText.toLowerCase()
  const summaryText = getSectionText(sections, ['ringkasan'])

  // ===== KONTAK (maks 15) =====
  const emailMatch = lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
  const emailScore = emailMatch ? 6 : 0
  const phone = findPhone(text)
  const phoneScore = phone ? 5 : 0
  const linkedinScore = lower.includes('linkedin.com') ? 2 : 0
  const portfolioUrl = findPortfolio(text)
  let workLinkScore = portfolioUrl ? 2 : 0
  let workLinkNote = portfolioUrl
    ? `Link karya terbaca: ${portfolioUrl}`
    : 'Link karya (GitHub, Behance, atau website pribadi) tidak ditemukan.'
  if (!portfolioUrl && linkedinScore > 0 && findDomicile(text)) {
    // Bidang yang tidak memamerkan karya: poin dialihkan sebagian ke LinkedIn + domisili.
    workLinkScore = 1
    workLinkNote =
      'Tidak ada link karya, tapi LinkedIn dan domisili tercantum — 1 dari 2 poin.'
  }
  const kontakChecks = [
    makeCheck(
      'email', 'Kontak', 'Email valid', emailScore, 6,
      emailMatch
        ? `6/6 - Email terbaca: ${emailMatch[0]}`
        : '0/6 - Alamat email tidak ditemukan atau formatnya tidak valid. Cantumkan email profesional yang aktif.',
    ),
    makeCheck(
      'hp', 'Kontak', 'Nomor HP Indonesia', phoneScore, 5,
      phone
        ? `5/5 - Nomor HP terbaca: ${phone}`
        : '0/5 - Nomor HP Indonesia tidak ditemukan. Cantumkan nomor aktif, misalnya 08xx atau +62 8xx.',
    ),
    makeCheck(
      'linkedin', 'Kontak', 'LinkedIn', linkedinScore, 2,
      linkedinScore > 0
        ? '2/2 - Tautan LinkedIn tercantum.'
        : '0/2 - Tautan LinkedIn tidak ditemukan. Cantumkan URL profil LinkedIn agar rekruter mudah memverifikasi profilmu.',
    ),
    makeCheck(
      'karya', 'Kontak', 'Link karya yang relevan', workLinkScore, 2,
      `${workLinkScore}/2 - ${workLinkNote}`,
    ),
  ]

  // ===== RINGKASAN (maks 10) =====
  const summaryWords = summaryText ? countWords(summaryText) : 0
  const lengthScore =
    summaryWords >= 20 && summaryWords <= 60
      ? 4
      : summaryWords >= 8 && summaryWords <= 19
        ? 2
        : summaryWords >= 61 && summaryWords <= 100
          ? 2
          : summaryWords >= 1
            ? 1
            : 0
  const role = options.targetRole?.trim() ?? ''
  const roleWords = role ? significantRoleWords(role) : []
  let roleMentionScore = 0
  let roleMentionNote: string
  if (roleWords.length > 0) {
    const mentioned = roleWords.filter((w) => hasWord(summaryText, w)).length
    roleMentionScore = mentioned >= Math.ceil(roleWords.length / 2) ? 3 : mentioned >= 1 ? 1.5 : 0
    roleMentionNote =
      mentioned > 0
        ? `menyebut peran target ("${role}")`
        : `tidak menyebut peran target ("${role}")`
  } else {
    roleMentionScore = ROLE_WORDS.some((w) => hasWord(summaryText, w)) ? 3 : 0
    roleMentionNote =
      roleMentionScore > 0
        ? 'menyebut bidang/peran yang dituju'
        : 'tidak menyebut peran yang dituju — isi posisi target agar bisa dinilai'
  }
  // Bukti terkuat: ringkasan merujuk pencapaian yang juga muncul sebagai bukti.
  const topForSummary = [...evidence].sort((a, b) => b.score - a.score)[0]
  let proofMentionScore = 0
  if (topForSummary) {
    const topNumbers = topForSummary.text.match(/\d+(?:[.,]\d+)?\s*(%|juta|ribu|orang|klien|proyek|jam|hari|bulan|tahun|people|users?|clients?|customers?|projects?|hours?|days?|months?|years?|teams?|members?|stores?|dollars?|usd)/gi) ?? []
    const topRolePhrase = topForSummary.title.split(/—|–/)[0]?.trim().toLowerCase() ?? ''
    const mentionsProof =
      topNumbers.some((n) => summaryText.toLowerCase().includes(n.toLowerCase())) ||
      (topRolePhrase.length >= 4 && summaryText.toLowerCase().includes(topRolePhrase))
    proofMentionScore = mentionsProof ? 3 : /\d/.test(summaryText) ? 1 : 0
  }
  const summaryScore = lengthScore + roleMentionScore + proofMentionScore
  const ringkasanChecks = [
    makeCheck(
      'ringkasan', 'Ringkasan', 'Ringkasan profesional', summaryScore, 10,
      `${summaryScore}/10 - Ringkasan ${summaryWords} kata (${lengthScore}/4 panjang); ${roleMentionNote} (${roleMentionScore}/3); ` +
        (proofMentionScore >= 3
          ? 'merujuk bukti terkuatmu (3/3).'
          : proofMentionScore > 0
            ? 'menyebut angka tapi belum merujuk bukti terkuatmu (1/3).'
            : 'belum merujuk bukti terkuatmu (0/3).'),
    ),
  ]

  // ===== BUKTI STAR (maks 30) =====
  // Hanya 3 bukti terbaik yang dihitung (dirata-rata, lalu dikali 3).
  // Slot kosong bernilai 0: satu bukti sempurna sendirian maksimal 10 dari 30.
  const ranked = [...evidence].sort((a, b) => b.score - a.score)
  const top3 = ranked.slice(0, 3)
  const top3Avg = top3.reduce((sum, e) => sum + e.score, 0) / 3
  const evidenceScore = Math.round(top3Avg * 3)
  const extraEvidence = ranked.slice(3).filter((e) => e.score >= 5)
  const buktiChecks = [
    makeCheck(
      'bukti-star', 'Bukti STAR', 'Bukti STAR (3 terbaik)', evidenceScore, 30,
      `${evidenceScore}/30 - Rata-rata STAR 3 bukti terbaik: ${top3Avg.toFixed(1)} dari 10 ` +
        `(${top3.length} dari 3 slot terisi). ` +
        (top3.length === 0
          ? 'Belum ada bukti yang bisa dinilai. Tambahkan magang, proyek, atau organisasi dengan peran, periode, aksi, dan hasil.'
          : top3.every((e) => e.reasons.length === 0)
            ? 'Ketiga bukti sudah lengkap (peran, periode, aksi, hasil).'
            : `Yang paling sering kurang: ${[...new Set(top3.flatMap((e) => e.reasons))].join('; ')}.`),
    ),
  ]

  // ===== PENDIDIKAN & BELAJAR (maks 15) =====
  const educationText = getSectionText(sections, ['pendidikan'])
  const hasInstitution = /(universitas|institut|sekolah|sma|smk|politeknik|akademi|university|college|bachelor|master|high school)/i.test(educationText)
  const eduYears = extractYears(educationText)
  const eduBaseScore = hasInstitution && eduYears.length > 0 ? 8 : hasInstitution ? 5 : educationText ? 3 : 0
  // IPK hanya dihitung bila ada DI DALAM bagian pendidikan (bukan di seluruh CV).
  const hasGpa = /(ipk|gpa)\s*[:\-]?\s*[0-4]([.,]\d{1,2})?/i.test(educationText)
  const gpaScore = hasGpa ? 4 : 0
  const certText = getSectionText(sections, ['sertifikasi'])
  const certLine = text
    .split('\n')
    .find((l) => /(sertifikat|sertifikasi|kursus|bootcamp|pelatihan|certified|certificate|course|training)/i.test(l) && l.trim().length > 15)
  const hasCert = certText.length > 0 || Boolean(certLine)
  const certScore = hasCert ? 3 : 0
  // Aturan pengganti yang adil: IPK + sertifikat digabung, maksimal 7.
  const learnScore = Math.min(7, gpaScore + certScore)
  const pendidikanChecks = [
    makeCheck(
      'pendidikan', 'Pendidikan & Belajar', 'Pendidikan tercantum', eduBaseScore, 8,
      `${eduBaseScore}/8 - ` +
        (eduBaseScore >= 8
          ? 'Institusi, jurusan, dan tahun tercantum.'
          : eduBaseScore > 0
            ? 'Institusi tercantum, tapi tahun atau jurusan belum lengkap.'
            : 'Informasi pendidikan tidak ditemukan. Cantumkan jenjang, institusi, dan tahun.'),
    ),
    makeCheck(
      'ipk-sertifikat', 'Pendidikan & Belajar', 'IPK / sertifikat', learnScore, 7,
      `${learnScore}/7 - ` +
        (hasGpa && hasCert
          ? 'IPK tercantum dan ada sertifikat/pelatihan.'
          : hasGpa
            ? 'IPK tercantum (sertifikat bisa menambah sampai 7).'
            : hasCert
              ? 'Sertifikat/pelatihan menggantikan IPK — bukti belajar tetap dinilai.'
              : 'IPK dan sertifikat tidak tercantum. Cantumkan salah satunya.'),
    ),
  ]

  // ===== SKILL RELEVAN (maks 15) =====
  const skillsText = getSectionText(sections, ['keahlian'])
  const skillItems = parseSkillItems(skillsText)
  const provenSkills = skillItems.filter((s) => {
    const pattern = new RegExp(`\\b${escapeRegExp(s)}\\b`, 'i')
    return pattern.test(evidenceText)
  })
  const unprovenSkills = skillItems.filter((s) => !provenSkills.includes(s))
  const provenScore =
    provenSkills.length >= 5 ? 9
      : provenSkills.length === 4 ? 8
        : provenSkills.length === 3 ? 6
          : provenSkills.length === 2 ? 4
            : provenSkills.length === 1 ? 2
              : 0
  const jobDesc = options.jobDesc?.trim() ?? ''
  const keywords = jobDesc ? extractJobKeywords(jobDesc, lower, evidenceLower) : null
  let relevanceScore = 0
  let relevanceNote: string
  if (keywords) {
    const inEv = keywords.inEvidence.length
    relevanceScore = inEv >= 6 ? 6 : inEv >= 4 ? 4 : inEv >= 2 ? 3 : inEv === 1 ? 1 : 0
    relevanceNote = `${inEv} dari ${keywords.total} kata kunci lowongan ditemukan di dalam bukti`
  } else if (roleWords.length > 0) {
    const roleInEvidence = roleWords.filter((w) => hasWord(evidenceLower, w)).length
    relevanceScore = roleInEvidence >= 2 ? 6 : roleInEvidence === 1 ? 3 : 0
    relevanceNote =
      roleInEvidence > 0
        ? 'skill terbukti selaras dengan posisi target'
        : 'belum ada skill terbukti yang selaras dengan posisi target'
  } else {
    relevanceScore = Math.round((6 * provenScore) / 9)
    relevanceNote = 'tanpa lowongan/posisi target, dinilai proporsional dari skill terbukti'
  }
  const skillChecks = [
    makeCheck(
      'skill-terbukti', 'Skill Relevan', 'Skill terbukti di bukti', provenScore, 9,
      `${provenScore}/9 - ${provenSkills.length} dari ${skillItems.length} skill-mu terbukti muncul di dalam bukti` +
        (unprovenSkills.length > 0
          ? `; ${unprovenSkills.length} skill hanya klaim dan belum punya bukti.`
          : '.'),
    ),
    makeCheck(
      'skill-relevan', 'Skill Relevan', 'Relevansi dengan lowongan', relevanceScore, 6,
      `${relevanceScore}/6 - ${relevanceNote}.`,
    ),
  ]

  // ===== FORMAT & ATS (maks 15) =====
  const lengthScore2 =
    totalWords >= 220 && totalWords <= 900
      ? 6
      : (totalWords >= 130 && totalWords <= 219) || (totalWords >= 901 && totalWords <= 1100)
        ? 4
        : totalWords >= 60 && totalWords <= 129
          ? 2
          : 1
  const mainSections = ['ringkasan', 'pendidikan', 'keahlian'].filter(
    (k) => sections.some((s) => s.kind === k),
  ).length + (evidence.length > 0 ? 1 : 0)
  const structureScore = mainSections >= 4 ? 5 : mainSections === 3 ? 3 : mainSections === 2 ? 2 : mainSections === 1 ? 1 : 0
  // Bullet dihitung dari baris asli di bagian bukti.
  const bulletCount = sections
    .filter((s) => EVIDENCE_KINDS[s.kind])
    .flatMap((s) => s.lines)
    .filter((l) => isBulletLine(l)).length
  const bulletScore = bulletCount >= 6 ? 4 : bulletCount >= 3 ? 2 : bulletCount >= 1 ? 1 : 0
  const formatChecks = [
    makeCheck(
      'panjang', 'Format & ATS', 'Panjang CV', lengthScore2, 6,
      `${lengthScore2}/6 - CV berisi ${totalWords} kata. Rentang ideal 220–900 kata (sekitar 1–2 halaman).`,
    ),
    makeCheck(
      'struktur', 'Format & ATS', 'Struktur terbaca', structureScore, 5,
      `${structureScore}/5 - ${mainSections} dari 4 bagian utama terdeteksi (ringkasan, bukti, pendidikan, keahlian).`,
    ),
    makeCheck(
      'bullet-bukti', 'Format & ATS', 'Bullet pada bukti', bulletScore, 4,
      `${bulletScore}/4 - Ditemukan ${bulletCount} baris bullet di bagian bukti. Susun pencapaianmu dalam poin-poin agar mudah dipindai rekruter dan sistem ATS.`,
    ),
  ]

  // ===== Agregasi: dua skor =====
  const aspectDefs: { name: string; max: number; checks: CheckItem[] }[] = [
    { name: 'Kontak', max: 15, checks: kontakChecks },
    { name: 'Ringkasan', max: 10, checks: ringkasanChecks },
    { name: 'Bukti STAR', max: 30, checks: buktiChecks },
    { name: 'Pendidikan & Belajar', max: 15, checks: pendidikanChecks },
    { name: 'Skill Relevan', max: 15, checks: skillChecks },
    { name: 'Format & ATS', max: 15, checks: formatChecks },
  ]
  const aspects: AspectResult[] = aspectDefs.map((a) => ({
    name: a.name,
    max: a.max,
    score: a.checks.reduce((sum, c) => sum + c.score, 0),
    checks: a.checks,
  }))
  const allChecks = aspects.flatMap((a) => a.checks)
  const rawTotal = aspects.reduce((sum, a) => sum + a.score, 0)
  const readyScore = applyCap(rawTotal)
  const readyLabel = labelFor(readyScore)

  // Skor Cocok: mulai dari Skor Siap, disesuaikan kecocokan dengan lowongan.
  let matchScore: number | null = null
  if (keywords) {
    matchScore = applyCap(Math.round(rawTotal * 0.7 + keywords.percent * 0.3))
  } else if (role) {
    const roleInEvidence = roleWords.some((w) => hasWord(evidenceLower, w))
    matchScore = roleInEvidence ? readyScore : applyCap(Math.round(readyScore * 0.85))
  }
  const matchLabel = matchScore === null ? null : labelFor(matchScore)

  const aspectMaxByName = new Map(aspects.map((a) => [a.name, a.max]))
  const strengths = allChecks.filter((c) => c.status === 'baik')
  const priorities = allChecks
    .filter((c) => c.status !== 'baik')
    .sort(
      (a, b) =>
        b.max - b.score - (a.max - a.score) ||
        (aspectMaxByName.get(b.aspect) ?? 0) - (aspectMaxByName.get(a.aspect) ?? 0),
    )

  // ===== Peringatan (tidak mengurangi skor diam-diam) =====
  const consistencyWarnings: string[] = []
  if (unprovenSkills.length > 0) {
    consistencyWarnings.push(
      `Skill belum terbukti: ${unprovenSkills.slice(0, 5).join(', ')}${unprovenSkills.length > 5 ? `, dan ${unprovenSkills.length - 5} lainnya` : ''} — hanya klaim, belum muncul di bukti mana pun. Tambahkan buktinya, bukan tambah skillnya.`,
    )
  }
  // Periode bertabrakan: dua bukti kerja penuh waktu dengan rentang tahun yang sama persis.
  const workEvidence = evidence.filter((e) => e.source === 'kerja')
  const seenRanges = new Map<string, string>()
  for (const e of workEvidence) {
    const years = extractYears(e.text)
    if (years.length >= 2) {
      const range = `${years[0]}-${years[years.length - 1]}`
      const prev = seenRanges.get(range)
      if (prev) {
        consistencyWarnings.push(
          `Periode bertabrakan: "${prev}" dan "${e.title}" sama-sama ${range}. Periksa lagi tanggalnya.`,
        )
      } else {
        seenRanges.set(range, e.title)
      }
    }
  }

  // Peringatan posisi: pakai frasa posisi, bukan kata pertama saja.
  let roleWarning: string | null = null
  if (role && roleWords.length > 0) {
    const inCv = roleWords.some((w) => hasWord(lower, w))
    const inEvidence = roleWords.some((w) => hasWord(evidenceLower, w))
    if (!inCv) {
      roleWarning = `Posisi target "${role}" tidak disebut di dalam CV. Sebutkan posisi atau bidang ini di ringkasan atau buktimu agar CV terlihat relevan.`
    } else if (!inEvidence) {
      roleWarning = `Posisi target "${role}" disebut di CV, tapi belum ada bukti (pengalaman/proyek) yang mendukungnya.`
    }
  }

  // Catatan pindah mode (mode adalah batas bawah, bukan batas atas).
  let modeNote: string | null = null
  if (mode === 'fresh') {
    const longWork = workEvidence.some((e) => {
      const years = extractYears(e.text)
      if (years.length >= 2) return years[years.length - 1] - years[0] >= 2
      if (years.length === 1 && /sekarang|saat ini/i.test(e.text)) {
        return new Date().getFullYear() - years[0] >= 2
      }
      return false
    })
    if (longWork) {
      modeNote =
        'Pengalamanmu sudah setara Berpengalaman (kerja penuh waktu lebih dari 1 tahun). Coba ganti mode ke Berpengalaman agar penilaiannya lebih tepat. Keputusan tetap di tanganmu.'
    }
  } else if (workEvidence.length === 0) {
    modeNote =
      'Belum ada pengalaman kerja yang terdeteksi. Bila kamu baru lulus, coba mode Fresh Graduate agar magang dan proyekmu ikut dinilai.'
  }

  return {
    total: readyScore,
    label: readyLabel,
    readyScore,
    readyLabel,
    rawTotal,
    matchScore,
    matchLabel,
    mode,
    cvLanguage,
    aspects,
    strengths,
    priorities,
    topEvidence: top3,
    extraEvidence,
    allEvidence: ranked,
    keywords,
    roleWarning,
    modeNote,
    consistencyWarnings,
    portfolioUrl,
    wordCount: totalWords,
  }
}
