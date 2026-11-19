// Taksonomi skill kanonik — pencocokan semantik untuk screening-cv (v1).
//
// Menggantikan SKILL_SYNONYMS (9 entri) di analyze.ts. Satu konsep = satu id kanonik,
// apa pun cara penulisannya: 'MySQL' -> sql, 'MS Excel' -> excel, 'PowerBI' -> power-bi.
//
// Aturan keamanan pencocokan (jangan dilonggarkan tanpa tes):
// - Pencocokan berbasis TOKEN, bukan substring: 'excel' tidak cocok di 'excelled',
//   'IT' tidak cocok di dalam kata lain, 'C#' tidak pernah cocok sebagai huruf 'c'.
// - Alias yang ternormalisasi menjadi < 2 karakter dilewati (mis. 'C#' -> 'c', 'R' -> 'r').
// - Kata umum TIDAK dipakai sebagai alias: 'go' (bukan golang), 'ai' (bukan illustrator),
//   'rest' (bukan api), 'office' (bukan microsoft office), 'cs', 'pm', 'ga', 'ps', 'next'.
// - Kata generik TIDAK mengimplikasikan: 'dashboard' sebagai kata tidak membuktikan Tableau;
//   hanya nama tool/teknik spesifik yang mengimplikasikan (power-bi -> visualisasi data).
// - Implikasi SATU tingkat saja, tanpa rantai: pandas -> python, tapi python TIDAK -> django.
//
// Menambah skill: satu id kanonik per konsep, alias harus tidak ambigu, lalu naikkan
// TAXONOMY_VERSION dan catat di changelog singkat di bawah.

export const TAXONOMY_VERSION = 1

// v1: 126 skill. Changelog: 1 = taksonomi awal (2026-11-19).

export interface SkillEntry {
  id: string
  labelId: string
  labelEn: string
  aliases: string[]
  family: string
  implies: string[]
}

type EntrySpec = [
  id: string,
  labelId: string,
  labelEn: string,
  aliases: string[],
  family: string,
  implies?: string[],
]

const SPECS: EntrySpec[] = [
  // --- Data ---
  ['sql', 'SQL', 'SQL', ['mysql', 'postgresql', 'postgres', 'structured query language', 'sql server'], 'data', ['database']],
  ['database', 'Database', 'Database', ['basis data', 'rdbms'], 'data'],
  ['mongodb', 'MongoDB', 'MongoDB', ['mongo db'], 'data', ['database', 'nosql']],
  ['nosql', 'NoSQL', 'NoSQL', ['no sql'], 'data', ['database']],
  ['excel', 'Excel', 'Excel', ['microsoft excel', 'ms excel', 'spreadsheet', 'google sheets'], 'data'],
  ['power-bi', 'Power BI', 'Power BI', ['powerbi', 'microsoft power bi'], 'data', ['data-visualization']],
  ['tableau', 'Tableau', 'Tableau', [], 'data', ['data-visualization']],
  ['looker-studio', 'Looker Studio', 'Looker Studio', ['looker studio', 'google data studio', 'data studio'], 'data', ['data-visualization']],
  ['data-visualization', 'Visualisasi Data', 'Data Visualization', ['data visualization', 'visualisasi data', 'dashboard'], 'data'],
  ['statistics', 'Statistik', 'Statistics', ['statistik', 'statistical analysis', 'analisis statistik'], 'data'],
  ['spss', 'SPSS', 'SPSS', [], 'data', ['statistics']],
  ['r-lang', 'R', 'R', ['r programming', 'bahasa r', 'r studio'], 'data', ['statistics']],
  ['google-analytics', 'Google Analytics', 'Google Analytics', ['google analytics', 'ga4'], 'data'],
  ['etl', 'ETL', 'ETL', ['extract transform load'], 'data'],
  ['data-cleaning', 'Pembersihan Data', 'Data Cleaning', ['data cleaning', 'pembersihan data', 'data cleansing'], 'data'],
  ['big-data', 'Big Data', 'Big Data', ['big data'], 'data'],
  ['data-mining', 'Data Mining', 'Data Mining', ['data mining', 'penambangan data'], 'data'],
  ['machine-learning', 'Machine Learning', 'Machine Learning', ['ml', 'pembelajaran mesin'], 'data'],
  ['scikit-learn', 'Scikit-learn', 'Scikit-learn', ['sklearn'], 'data', ['python', 'machine-learning']],
  ['vba', 'VBA', 'VBA', ['visual basic', 'vba excel'], 'data', ['excel']],
  // --- Pemrograman ---
  ['python', 'Python', 'Python', ['python3'], 'pemrograman'],
  ['pandas', 'Pandas', 'Pandas', [], 'pemrograman', ['python']],
  ['numpy', 'NumPy', 'NumPy', [], 'pemrograman', ['python']],
  ['javascript', 'JavaScript', 'JavaScript', ['js', 'ecmascript'], 'pemrograman'],
  ['typescript', 'TypeScript', 'TypeScript', ['ts'], 'pemrograman', ['javascript']],
  ['react', 'React', 'React', ['reactjs', 'react js'], 'pemrograman', ['javascript']],
  ['nodejs', 'Node.js', 'Node.js', ['node js', 'nodejs'], 'pemrograman', ['javascript']],
  ['vue', 'Vue', 'Vue', ['vuejs', 'vue js'], 'pemrograman', ['javascript']],
  ['angular', 'Angular', 'Angular', ['angularjs'], 'pemrograman', ['javascript', 'typescript']],
  ['nextjs', 'Next.js', 'Next.js', ['next js', 'nextjs'], 'pemrograman', ['javascript', 'react']],
  ['html', 'HTML', 'HTML', ['html5'], 'pemrograman'],
  ['css', 'CSS', 'CSS', ['css3'], 'pemrograman'],
  ['git', 'Git', 'Git', ['github', 'gitlab', 'version control', 'kontrol versi'], 'pemrograman'],
  ['docker', 'Docker', 'Docker', ['containerization', 'kontainerisasi'], 'pemrograman'],
  ['kubernetes', 'Kubernetes', 'Kubernetes', ['k8s'], 'pemrograman', ['docker']],
  ['api', 'API', 'API', ['rest api', 'restful api', 'api development', 'web api'], 'pemrograman'],
  ['java', 'Java', 'Java', ['java programming'], 'pemrograman'],
  ['spring', 'Spring', 'Spring', ['spring boot'], 'pemrograman', ['java']],
  ['php', 'PHP', 'PHP', ['php programming'], 'pemrograman'],
  ['laravel', 'Laravel', 'Laravel', [], 'pemrograman', ['php']],
  ['golang', 'Go', 'Go', ['golang', 'go programming', 'go lang'], 'pemrograman'],
  ['c-sharp', 'C#', 'C#', ['c sharp'], 'pemrograman'],
  ['cpp', 'C++', 'C++', ['c plus plus', 'cpp'], 'pemrograman'],
  ['c-lang', 'C', 'C', ['c programming', 'bahasa c'], 'pemrograman'],
  ['ruby', 'Ruby', 'Ruby', ['ruby programming'], 'pemrograman'],
  ['rails', 'Ruby on Rails', 'Ruby on Rails', ['ruby on rails', 'rails'], 'pemrograman', ['ruby']],
  ['rust', 'Rust', 'Rust', ['rust programming'], 'pemrograman'],
  ['flutter', 'Flutter', 'Flutter', ['dart'], 'pemrograman'],
  ['kotlin', 'Kotlin', 'Kotlin', [], 'pemrograman'],
  ['swift', 'Swift', 'Swift', [], 'pemrograman'],
  ['android', 'Android', 'Android', ['android development'], 'pemrograman'],
  ['ios', 'iOS', 'iOS', ['ios development'], 'pemrograman'],
  ['linux', 'Linux', 'Linux', ['ubuntu', 'unix'], 'pemrograman'],
  ['testing', 'Software Testing', 'Software Testing', ['software testing', 'unit testing', 'integration testing'], 'pemrograman'],
  ['qa', 'QA', 'QA', ['quality assurance', 'quality control'], 'pemrograman', ['testing']],
  ['ci-cd', 'CI/CD', 'CI/CD', ['ci cd', 'continuous integration', 'continuous deployment'], 'pemrograman'],
  ['devops', 'DevOps', 'DevOps', [], 'pemrograman', ['docker', 'ci-cd']],
  // --- Desain ---
  ['figma', 'Figma', 'Figma', [], 'desain', ['ui-design']],
  ['ui-design', 'Desain UI', 'UI Design', ['ui design', 'desain ui', 'user interface', 'user interface design'], 'desain'],
  ['ux-research', 'Riset UX', 'UX Research', ['ux research', 'riset ux', 'user experience', 'user research'], 'desain'],
  ['desain-grafis', 'Desain Grafis', 'Graphic Design', ['graphic design', 'desain grafis', 'graphic designer', 'desainer grafis'], 'desain'],
  ['prototyping', 'Prototyping', 'Prototyping', ['prototype', 'prototyping', 'wireframing', 'wireframe'], 'desain', ['ui-design']],
  ['photoshop', 'Photoshop', 'Photoshop', ['adobe photoshop'], 'desain', ['desain-grafis']],
  ['illustrator', 'Illustrator', 'Illustrator', ['adobe illustrator'], 'desain', ['desain-grafis']],
  ['canva', 'Canva', 'Canva', [], 'desain', ['desain-grafis']],
  ['after-effects', 'After Effects', 'After Effects', ['after effects', 'adobe after effects'], 'desain'],
  ['coreldraw', 'CorelDRAW', 'CorelDRAW', ['corel draw'], 'desain', ['desain-grafis']],
  ['sketch', 'Sketch', 'Sketch', ['sketch app'], 'desain', ['ui-design']],
  ['adobe-xd', 'Adobe XD', 'Adobe XD', ['adobe xd'], 'desain', ['ui-design']],
  ['motion-design', 'Motion Design', 'Motion Design', ['motion design', 'motion graphics'], 'desain'],
  // --- Pemasaran ---
  ['seo', 'SEO', 'SEO', ['search engine optimization', 'optimasi seo'], 'pemasaran'],
  ['social-media', 'Media Sosial', 'Social Media', ['social media', 'media sosial', 'sosmed'], 'pemasaran'],
  ['content-writing', 'Content Writing', 'Content Writing', ['content writing', 'penulisan konten'], 'pemasaran'],
  ['copywriting', 'Copywriting', 'Copywriting', [], 'pemasaran', ['content-writing']],
  ['meta-ads', 'Meta Ads', 'Meta Ads', ['meta ads', 'facebook ads', 'instagram ads', 'fb ads', 'ig ads'], 'pemasaran'],
  ['google-ads', 'Google Ads', 'Google Ads', ['google ads', 'adwords'], 'pemasaran'],
  ['email-marketing', 'Email Marketing', 'Email Marketing', ['email marketing', 'pemasaran email', 'mailchimp'], 'pemasaran'],
  ['digital-marketing', 'Digital Marketing', 'Digital Marketing', ['digital marketing', 'pemasaran digital'], 'pemasaran'],
  ['branding', 'Branding', 'Branding', ['brand management', 'manajemen merek'], 'pemasaran'],
  ['market-research', 'Riset Pasar', 'Market Research', ['market research', 'riset pasar', 'riset market'], 'pemasaran'],
  ['public-speaking', 'Public Speaking', 'Public Speaking', ['public speaking', 'berbicara di depan umum'], 'pemasaran', ['communication']],
  ['communication', 'Komunikasi', 'Communication', ['komunikasi', 'communication', 'interpersonal'], 'pemasaran'],
  ['negotiation', 'Negosiasi', 'Negotiation', ['negosiasi', 'negotiation'], 'pemasaran'],
  ['content-creator', 'Content Creator', 'Content Creator', ['content creator', 'kreator konten'], 'pemasaran', ['content-writing']],
  ['crm', 'CRM', 'CRM', ['customer relationship management', 'salesforce', 'hubspot'], 'pemasaran'],
  // --- Perkantoran ---
  ['word', 'Microsoft Word', 'Microsoft Word', ['microsoft word', 'ms word'], 'perkantoran'],
  ['powerpoint', 'PowerPoint', 'PowerPoint', ['microsoft powerpoint', 'ms powerpoint', 'ppt'], 'perkantoran'],
  ['microsoft-office', 'Microsoft Office', 'Microsoft Office', ['ms office', 'microsoft office'], 'perkantoran', ['word', 'excel', 'powerpoint']],
  ['administrasi', 'Administrasi', 'Administration', ['administration', 'administrasi perkantoran', 'admin', 'kesekretariatan'], 'perkantoran'],
  ['data-entry', 'Data Entry', 'Data Entry', ['data entry', 'entri data', 'input data'], 'perkantoran', ['excel']],
  ['customer-service', 'Customer Service', 'Customer Service', ['customer service', 'layanan pelanggan', 'pelayanan pelanggan'], 'perkantoran'],
  ['typing', 'Mengetik', 'Typing', ['mengetik', 'typing speed', 'keyboarding'], 'perkantoran'],
  ['filing', 'Pengarsipan', 'Filing', ['pengarsipan', 'filing', 'kearsipan'], 'perkantoran'],
  ['scheduling', 'Penjadwalan', 'Scheduling', ['penjadwalan', 'scheduling', 'manajemen jadwal'], 'perkantoran'],
  ['surat-menyurat', 'Surat Menyurat', 'Correspondence', ['surat menyurat', 'correspondence'], 'perkantoran'],
  // --- Bahasa ---
  ['inggris', 'Bahasa Inggris', 'English', ['english', 'bahasa inggris'], 'bahasa'],
  ['indonesia', 'Bahasa Indonesia', 'Indonesian', ['bahasa indonesia', 'indonesian'], 'bahasa'],
  ['arab', 'Bahasa Arab', 'Arabic', ['arabic', 'bahasa arab'], 'bahasa'],
  ['mandarin', 'Bahasa Mandarin', 'Mandarin', ['mandarin', 'bahasa mandarin', 'chinese', 'bahasa cina'], 'bahasa'],
  ['jepang', 'Bahasa Jepang', 'Japanese', ['japanese', 'bahasa jepang'], 'bahasa'],
  ['korea', 'Bahasa Korea', 'Korean', ['korean', 'bahasa korea'], 'bahasa'],
  ['jerman', 'Bahasa Jerman', 'German', ['german', 'bahasa jerman'], 'bahasa'],
  ['perancis', 'Bahasa Prancis', 'French', ['french', 'bahasa perancis', 'bahasa prancis'], 'bahasa'],
  // --- Keuangan ---
  ['akuntansi', 'Akuntansi', 'Accounting', ['accounting', 'akuntansi dasar', 'akuntansi keuangan'], 'keuangan'],
  ['pajak', 'Pajak', 'Tax', ['tax', 'perpajakan', 'tax accounting'], 'keuangan'],
  ['laporan-keuangan', 'Laporan Keuangan', 'Financial Statement', ['laporan keuangan', 'financial statement', 'financial reporting', 'pembukuan', 'bookkeeping'], 'keuangan', ['akuntansi']],
  ['audit', 'Audit', 'Audit', ['auditing', 'audit internal', 'internal audit'], 'keuangan', ['akuntansi']],
  ['accurate', 'Accurate', 'Accurate', ['accurate online'], 'keuangan', ['akuntansi']],
  ['myob', 'MYOB', 'MYOB', ['myob accounting'], 'keuangan', ['akuntansi']],
  ['sap', 'SAP', 'SAP', ['sap erp'], 'keuangan'],
  ['analisis-keuangan', 'Analisis Keuangan', 'Financial Analysis', ['analisis keuangan', 'financial analysis', 'analisa keuangan'], 'keuangan', ['akuntansi']],
  ['budgeting', 'Budgeting', 'Budgeting', ['budgeting', 'penyusunan anggaran', 'anggaran'], 'keuangan'],
  ['investasi', 'Investasi', 'Investment', ['investment'], 'keuangan'],
  // --- Operasional ---
  ['manajemen-proyek', 'Manajemen Proyek', 'Project Management', ['project management', 'manajemen proyek'], 'operasional'],
  ['leadership', 'Kepemimpinan', 'Leadership', ['kepemimpinan', 'leadership', 'memimpin tim'], 'operasional'],
  ['teamwork', 'Kerja Sama Tim', 'Teamwork', ['kerja sama tim', 'teamwork', 'kerjasama'], 'operasional'],
  ['problem-solving', 'Problem Solving', 'Problem Solving', ['problem solving', 'pemecahan masalah', 'analytical thinking'], 'operasional'],
  ['time-management', 'Manajemen Waktu', 'Time Management', ['time management', 'manajemen waktu'], 'operasional'],
  ['ms-project', 'Microsoft Project', 'Microsoft Project', ['microsoft project', 'ms project'], 'operasional', ['manajemen-proyek']],
  ['trello', 'Trello', 'Trello', [], 'operasional', ['manajemen-proyek']],
  ['asana', 'Asana', 'Asana', [], 'operasional', ['manajemen-proyek']],
  ['jira', 'Jira', 'Jira', [], 'operasional', ['manajemen-proyek']],
  ['scrum', 'Scrum', 'Scrum', ['scrum master'], 'operasional', ['agile']],
  ['agile', 'Agile', 'Agile', ['agile methodology'], 'operasional'],
  ['logistik', 'Logistik', 'Logistics', ['logistics', 'supply chain', 'rantai pasok'], 'operasional'],
  ['procurement', 'Procurement', 'Procurement', ['procurement', 'pengadaan'], 'operasional'],
]

export const SKILL_TAXONOMY: SkillEntry[] = SPECS.map(
  ([id, labelId, labelEn, aliases, family, implies = []]) => ({
    id,
    labelId,
    labelEn,
    aliases,
    family,
    implies,
  }),
)

// ---------- Normalisasi & pencocokan ----------

/** Huruf kecil, semua non-alphanumerik jadi satu spasi. 'Node.js' -> 'node js'. */
export function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  const n = normalizeToken(text)
  return n ? n.split(' ') : []
}

interface MatchForm {
  tokens: string[]
}

/** Bentuk pencocokan tiap frasa: urutan token + bentuk padat bila multi-kata. */
function matchFormsFor(phrase: string): MatchForm[] {
  const tokens = tokenize(phrase)
  if (tokens.length === 0) return []
  const forms: MatchForm[] = [{ tokens }]
  if (tokens.length > 1) forms.push({ tokens: [tokens.join('')] })
  return forms
}

function matchesTokens(textTokens: string[], form: MatchForm): boolean {
  const { tokens } = form
  if (tokens.length === 1) return textTokens.includes(tokens.join(' '))
  for (let i = 0; i + tokens.length <= textTokens.length; i++) {
    let ok = true
    for (let j = 0; j < tokens.length; j++) {
      if (textTokens[i + j] !== tokens[j]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

const BY_ID = new Map<string, SkillEntry>()
const FORMS: { form: MatchForm; entry: SkillEntry }[] = []

for (const entry of SKILL_TAXONOMY) {
  BY_ID.set(entry.id, entry)
  const seen = new Set<string>()
  for (const phrase of [entry.labelId, entry.labelEn, ...entry.aliases]) {
    for (const form of matchFormsFor(phrase)) {
      const key = form.tokens.join(' ')
      // Bentuk < 2 karakter dilewati: 'C#' -> 'c', 'R' -> 'r' tidak pernah cocok.
      if (key.length < 2 || seen.has(key)) continue
      seen.add(key)
      FORMS.push({ form, entry })
    }
  }
}

export function getSkillEntry(id: string): SkillEntry | undefined {
  return BY_ID.get(id)
}

export function skillLabel(id: string): string {
  return BY_ID.get(id)?.labelId ?? id
}

/**
 * Kanonikalisasi satu item skill (mis. satu baris dari bagian Keahlian).
 * Mengembalikan semua id kanonik yang terkandung di dalamnya (biasanya 1;
 * 'Microsoft Office' mengembalikan ['microsoft-office'], bukan ketiganya —
 * implikasi hanya berlaku saat mencocokkan teks bukti, lihat findSkillsInText).
 * [] bila tak dikenal — pemanggil mempertahankan bentuk literalnya.
 */
export function canonicalizeSkill(raw: string): string[] {
  const tokens = tokenize(raw)
  const ids: string[] = []
  if (tokens.length === 0) return ids
  for (const { form, entry } of FORMS) {
    if (matchesTokens(tokens, form) && !ids.includes(entry.id)) ids.push(entry.id)
  }
  return ids
}

/**
 * Semua skill kanonik yang muncul di teks (alias langsung + implikasi SATU tingkat).
 * 'Power BI' di teks -> { power-bi, data-visualization }.
 * 'pandas' -> { pandas, python }. Python TIDAK merambat ke django.
 */
export function findSkillsInText(text: string): Set<string> {
  const tokens = tokenize(text)
  const found = new Set<string>()
  if (tokens.length === 0) return found
  for (const { form, entry } of FORMS) {
    if (matchesTokens(tokens, form)) found.add(entry.id)
  }
  for (const id of [...found]) {
    const entry = BY_ID.get(id)
    if (!entry) continue
    for (const implied of entry.implies) {
      if (BY_ID.has(implied)) found.add(implied)
    }
  }
  return found
}
