// Profil peran — rubrik per peran untuk screening-cv (v1).
//
// Satu rubrik untuk semua peran itu tidak adil: CV Desainer tidak seharusnya dinilai
// dengan bobot yang sama seperti CV Akuntan. Tiap profil hanya menggeser BOBOT aspek
// (total tetap 100); cara menilai di dalam tiap aspek tidak berubah (lihat analyze.ts).
// STAR tetap universal — jangkar kejujuran engine.
//
// v1: 6 profil. 'umum' adalah fallback dan bobotnya = bobot lama (kompatibel mundur penuh:
// CV tanpa posisi target yang cocok tetap mendapat skor yang sama seperti sebelumnya).

export const ASPECT_NAMES = [
  'Kontak',
  'Ringkasan',
  'Bukti STAR',
  'Pendidikan & Belajar',
  'Skill Relevan',
  'Format & ATS',
] as const

export type AspectName = (typeof ASPECT_NAMES)[number]

export interface RoleProfile {
  id: string
  label: string
  /** Frasa judul (id/en) untuk deteksi otomatis. Longest-match menang. */
  matchers: string[]
  /** Bobot per aspek. Total tiap profil WAJIB 100 (ditegakkan oleh tes). */
  weights: Record<AspectName, number>
  /** 4 id skill kanonik (lihat skills.ts) yang wajib ada untuk peran ini. */
  requiredSkills: string[]
  /** 4 id skill kanonik pelengkap. */
  niceSkills: string[]
}

export const ROLE_PROFILES: RoleProfile[] = [
  {
    id: 'umum',
    label: 'Umum',
    matchers: [],
    weights: {
      Kontak: 15,
      Ringkasan: 10,
      'Bukti STAR': 30,
      'Pendidikan & Belajar': 15,
      'Skill Relevan': 15,
      'Format & ATS': 15,
    },
    requiredSkills: [],
    niceSkills: [],
  },
  {
    id: 'data-analyst',
    label: 'Data Analyst',
    matchers: ['data analyst', 'analis data', 'data scientist', 'business intelligence', 'bi analyst'],
    weights: {
      Kontak: 10,
      Ringkasan: 10,
      'Bukti STAR': 30,
      'Pendidikan & Belajar': 15,
      'Skill Relevan': 20,
      'Format & ATS': 15,
    },
    requiredSkills: ['sql', 'excel', 'data-visualization', 'statistics'],
    niceSkills: ['python', 'power-bi', 'tableau', 'spss'],
  },
  {
    id: 'developer',
    label: 'Software Developer',
    matchers: [
      'software engineer',
      'software developer',
      'programmer',
      'web developer',
      'backend developer',
      'frontend developer',
      'full stack',
      'fullstack',
    ],
    weights: {
      Kontak: 10,
      Ringkasan: 10,
      'Bukti STAR': 30,
      'Pendidikan & Belajar': 10,
      'Skill Relevan': 25,
      'Format & ATS': 15,
    },
    requiredSkills: ['javascript', 'git', 'sql', 'api'],
    niceSkills: ['react', 'typescript', 'python', 'docker'],
  },
  {
    id: 'digital-marketing',
    label: 'Digital Marketing',
    matchers: ['digital marketing', 'social media', 'seo specialist', 'content creator', 'marketing'],
    weights: {
      Kontak: 10,
      Ringkasan: 15,
      'Bukti STAR': 30,
      'Pendidikan & Belajar': 10,
      'Skill Relevan': 20,
      'Format & ATS': 15,
    },
    requiredSkills: ['seo', 'social-media', 'content-writing', 'google-analytics'],
    niceSkills: ['meta-ads', 'email-marketing', 'copywriting', 'canva'],
  },
  {
    id: 'desainer',
    label: 'Desainer',
    matchers: [
      'ui/ux designer',
      'ui designer',
      'ux designer',
      'graphic designer',
      'desainer grafis',
      'desainer',
    ],
    weights: {
      Kontak: 10,
      Ringkasan: 10,
      'Bukti STAR': 25,
      'Pendidikan & Belajar': 10,
      'Skill Relevan': 25,
      'Format & ATS': 20,
    },
    requiredSkills: ['figma', 'desain-grafis', 'prototyping', 'ui-design'],
    niceSkills: ['photoshop', 'illustrator', 'canva', 'after-effects'],
  },
  {
    id: 'akuntan',
    label: 'Akuntan / Finance',
    matchers: ['akuntan', 'accountant', 'staff keuangan', 'finance', 'auditor', 'pajak'],
    weights: {
      Kontak: 15,
      Ringkasan: 10,
      'Bukti STAR': 30,
      'Pendidikan & Belajar': 20,
      'Skill Relevan': 10,
      'Format & ATS': 15,
    },
    requiredSkills: ['excel', 'akuntansi', 'pajak', 'laporan-keuangan'],
    niceSkills: ['accurate', 'myob', 'sap', 'audit'],
  },
]

export const DEFAULT_ROLE_PROFILE_ID = 'umum'

export function getRoleProfile(id: string | undefined | null): RoleProfile {
  const found = ROLE_PROFILES.find((p) => p.id === id)
  if (found) return found
  const umum = ROLE_PROFILES.find((p) => p.id === DEFAULT_ROLE_PROFILE_ID)
  if (!umum) throw new Error('Profil peran "umum" tidak ditemukan di ROLE_PROFILES')
  return umum
}

export interface DetectedProfile {
  profile: RoleProfile
  /** Alasan deteksi, ditampilkan ke pengguna (transparan, tidak diam-diam). */
  reason: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Deteksi profil dari posisi target dulu, lalu dari deskripsi lowongan.
 * Longest-match menang; seri -> profil yang lebih dulu di daftar.
 * Tidak ada yang cocok -> profil Umum.
 */
export function detectRoleProfile(targetRole?: string, jobDesc?: string): DetectedProfile {
  const sources: { text: string; kind: string }[] = []
  if (targetRole && targetRole.trim()) sources.push({ text: targetRole, kind: 'posisi target' })
  if (jobDesc && jobDesc.trim()) sources.push({ text: jobDesc, kind: 'deskripsi lowongan' })
  for (const { text, kind } of sources) {
    const lower = ` ${normalize(text)} `
    let best: { profile: RoleProfile; matcher: string; len: number } | null = null
    for (const profile of ROLE_PROFILES) {
      for (const matcher of profile.matchers) {
        const m = ` ${normalize(matcher)} `
        if (lower.includes(m) && (!best || matcher.length > best.len)) {
          best = { profile, matcher, len: matcher.length }
        }
      }
    }
    if (best) {
      return { profile: best.profile, reason: `cocok dengan ${kind} (frasa "${best.matcher}")` }
    }
  }
  return {
    profile: getRoleProfile(DEFAULT_ROLE_PROFILE_ID),
    reason: 'tidak ada profil peran yang cocok — memakai rubrik Umum',
  }
}
