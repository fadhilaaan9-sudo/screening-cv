// Backend Analisis AI - Vercel Serverless Function.
//
// Alur: browser - POST /api/analyze-ai → fungsi ini → OpenRouter → JSON kembali ke browser.
// API key hanya dibaca dari environment variable server (OPENROUTER_API_KEY) dan
// tidak pernah dikirim ke frontend. Isi CV hanya diteruskan ke OpenRouter untuk
// dianalisis - tidak dicatat ke log dan tidak disimpan di mana pun.

interface AiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  socket?: { remoteAddress?: string }
}

interface AiResponse {
  status: (code: number) => AiResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  // Hanya dipakai mode streaming (respons Node asli Vercel memilikinya):
  // menulis potongan aliran NDJSON dan menutup respons.
  write?: (chunk: string) => boolean
  end?: (chunk?: string) => void
}

interface RewriteItem {
  asli: string
  saran: string
  alasan: string
}

interface AiResult {
  ringkasan: string
  saranPenulisanUlang: RewriteItem[]
  kekurangan: string[]
  saranUntukLowongan: string
}

const MAX_CV_CHARS = 12_000
const MIN_CV_CHARS = 50
const MAX_JOBDESC_CHARS = 6_000
const MAX_ROLE_CHARS = 200

// Batas waktu menunggu respons OpenRouter per permintaan. Model gratis bisa
// sangat lambat; tanpa batas ini fungsi serverless menggantung sampai
// diputus platform dan pengguna tidak mendapat pesan yang jelas.
const UPSTREAM_TIMEOUT_MS = 55_000

// Mode streaming: batas waktu keseluruhan aliran lebih longgar karena proses
// berpikir model ditampilkan langsung ke pengguna, dan jatah token keluaran
// lebih besar agar penalaran + JSON jawaban sama-sama muat.
const STREAM_TIMEOUT_MS = 120_000
const STREAM_MAX_TOKENS = 6000

class UpstreamTimeoutError extends Error {
  constructor() {
    super('OpenRouter tidak merespons dalam batas waktu')
    this.name = 'UpstreamTimeoutError'
  }
}

// --- Rate limit sederhana in-memory per IP ---
// Best-effort per instance: state ini hidup di memori satu instance fungsi
// serverless, jadi bukan batas global. Cukup untuk menahan penyalahgunaan
// kasual; untuk batas yang tegas gunakan penyimpanan bersama
// (mis. Vercel KV / Upstash) di lapisan berikutnya.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX
}

function clientIp(req: AiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (first) return first.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

const SYSTEM_PROMPT =
  'Kamu adalah konsultan karier berbahasa Indonesia. CV yang kamu baca bisa berbahasa Indonesia atau Inggris — pahami dalam bahasa aslinya, jangan terjemahkan nama, perusahaan, atau angka. Balas HANYA dengan JSON valid sesuai skema yang diminta — tanpa markdown, tanpa pagar kode, tanpa teks pembuka/penutup. Semua penjelasanmu dalam Bahasa Indonesia; hanya isi field saran (versi tulis ulang) yang memakai bahasa asli CV agar bisa langsung ditempel kembali. Jangan mengarang pengalaman, perusahaan, atau angka yang tidak ada di CV.'

// Bahasa CV ditebak dari kata penanda — sama seperti di src/lib/analyze.ts.
// Dipakai hanya untuk aturan bahasa prompt, bukan untuk skor.
function detectAiCvLanguage(cvText: string): 'id' | 'en' {
  const words = new Set(cvText.toLowerCase().split(/[^a-z]+/))
  const idCount = ['yang', 'dan', 'dengan', 'saya', 'pengalaman', 'pendidikan', 'magang', 'proyek'].filter((w) => words.has(w)).length
  const enCount = ['the', 'and', 'with', 'experience', 'education', 'internship', 'project', 'managed'].filter((w) => words.has(w)).length
  return enCount > idCount ? 'en' : 'id'
}

function buildPrompt(cvText: string, targetRole: string, jobDesc: string): string {
  const rolePart = targetRole
    ? `\nPOSISI YANG DILAMAR: ${targetRole}\n`
    : ''
  const jobPart = jobDesc
    ? `\nDESKRIPSI LOWONGAN:\n${jobDesc}\n`
    : '\n(Tidak ada deskripsi lowongan — nilai kekurangan umum CV saja.)\n'
  return [
    'Kamu adalah konsultan karier berbahasa Indonesia yang membantu pencari kerja dan fresh graduate memperbaiki CV.',
    'BAHASA CV: ' + (detectAiCvLanguage(cvText) === 'en' ? 'Inggris' : 'Indonesia') + ' — pahami CV dalam bahasa aslinya, jangan terjemahkan nama, perusahaan, atau angka.',
    'Analisis CV berikut dan balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) dengan skema persis ini:',
    '{',
    '  "ringkasan": "penilaian kualitatif CV dalam 2-3 kalimat",',
    '  "saranPenulisanUlang": [ { "asli": "kalimat/poin asli dari CV", "saran": "versi penulisan ulang", "alasan": "kenapa versi baru lebih baik" } ],',
    '  "kekurangan": [ "kekurangan CV, maksimal 6 butir" ],',
    '  "saranUntukLowongan": "saran konsultan karier/HRD untuk lowongan yang dilamar, 3-5 kalimat"',
    '}',
    '',
    'Aturan ketat:',
    '- saranPenulisanUlang: ambil maksimal 5 poin dari bagian pengalaman CV. Tulis ulang dengan kata kerja aksi yang kuat dan struktur pencapaian.',
    '- JANGAN mengarang pengalaman, perusahaan, atau angka baru. Bila angka pencapaian tidak ada di CV, pakai placeholder seperti [X%], [jumlah], atau [angka] di dalam saran, dan jelaskan di alasan bahwa pengguna harus mengisi angka aslinya sendiri.',
    jobDesc
      ? '- kekurangan: nilai kesenjangan (gap) CV terhadap deskripsi lowongan secara MAKNA — skill/pengalaman yang dituntut lowongan tapi belum tampak di CV, bukan sekadar daftar kata kunci yang hilang.'
      : '- kekurangan: nilai kekurangan umum CV (struktur, kejelasan, bukti pencapaian, kelengkapan bagian).',
    '- saranUntukLowongan: tulis dari sudut pandang HRD/konsultan karier yang membaca CV ini untuk lowongan tersebut: apa yang dicari lowongan itu, pengalaman/skill mana dari CV yang paling cocok dan harus ditonjolkan, apa yang masih kurang untuk posisi itu, dan 3 langkah paling penting agar CV ini lolos untuk posisi itu. Langsung dan jujur, berdasarkan fakta di CV dan isi lowongan saja, jangan menambah klaim baru.',
    '- Bila tidak ada deskripsi lowongan/posisi target, saranUntukLowongan berisi saran posisi: jenis pekerjaan apa yang paling cocok dengan CV ini dan 3 langkah paling penting agar CV ini siap dilamar.',
    '- Bahasa hasil: ringkasan, kekurangan, alasan, dan saranUntukLowongan SELALU dalam Bahasa Indonesia yang jelas dan suportif.',
    '- saranPenulisanUlang: field asli salin apa adanya dari CV; field saran tulis ulang DALAM BAHASA ASLI CV (Inggris bila CV Inggris, Indonesia bila CV Indonesia) agar bisa langsung ditempel kembali ke CV; field alasan dalam Bahasa Indonesia.',
    rolePart,
    jobPart,
    'TEKS CV:',
    cvText,
  ].join('\n')
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

// Field array yang dikirim model tidak selalu rapi: string tunggal dibungkus
// menjadi array satu elemen, elemen non-string primitif diubah ke string,
// elemen objek/kosong dilewati.
function asStringList(value: unknown, max: number): string[] {
  if (value === null || value === undefined) return []
  const items = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const item of items) {
    const s = asString(item).trim()
    if (s) out.push(s)
    if (out.length >= max) break
  }
  return out
}

function normalizeRewrite(item: unknown): RewriteItem | null {
  if (typeof item === 'string') {
    const s = item.trim()
    return s ? { asli: '', saran: s, alasan: '' } : null
  }
  if (item && typeof item === 'object') {
    const it = item as Record<string, unknown>
    return {
      asli: asString(it.asli),
      saran: asString(it.saran),
      alasan: asString(it.alasan),
    }
  }
  return null
}

function normalizeResult(raw: unknown): AiResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  // Objek JSON yang sama sekali tidak memuat field skema dianggap bukan
  // jawaban analisis (mis. JSON lain yang kebetulan valid) → gagal parse.
  const hasKnownField = ['ringkasan', 'saranPenulisanUlang', 'kekurangan', 'saranUntukLowongan'].some(
    (key) => obj[key] !== undefined && obj[key] !== null,
  )
  if (!hasKnownField) return null

  const rewriteSource =
    obj.saranPenulisanUlang === null || obj.saranPenulisanUlang === undefined
      ? []
      : Array.isArray(obj.saranPenulisanUlang)
        ? obj.saranPenulisanUlang
        : [obj.saranPenulisanUlang]
  const rewrites: RewriteItem[] = []
  for (const item of rewriteSource) {
    const normalized = normalizeRewrite(item)
    if (normalized) rewrites.push(normalized)
    if (rewrites.length >= 5) break
  }

  return {
    ringkasan: asString(obj.ringkasan),
    saranPenulisanUlang: rewrites,
    kekurangan: asStringList(obj.kekurangan, 6),
    saranUntukLowongan: asString(obj.saranUntukLowongan),
  }
}

// Model reasoning sering membungkus proses berpikirnya dalam tag <think>
// atau <thinking>; blok itu dibuang sebelum parsing JSON.
function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ' ')
    .replace(/<\/?think(?:ing)?>/gi, ' ')
}

function tryParseJson(text: string): AiResult | null {
  try {
    return normalizeResult(JSON.parse(text))
  } catch {
    return null
  }
}

export function parseAiJson(text: string): AiResult | null {
  // Urutan percobaan dari yang paling bersih ke yang paling toleran:
  // parse langsung → buang pagar kode → ekstrak { ... } terluar.
  const cleaned = stripThinkBlocks(text).trim()
  if (!cleaned) return null
  const direct = tryParseJson(cleaned)
  if (direct) return direct
  const defenced = cleaned.replace(/```(?:json)?/gi, '').trim()
  if (defenced !== cleaned) {
    const fromDefenced = tryParseJson(defenced)
    if (fromDefenced) return fromDefenced
  }
  const start = defenced.indexOf('{')
  const end = defenced.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return tryParseJson(defenced.slice(start, end + 1))
  }
  return null
}

// Isi message.content kadang berupa array of parts, bukan string tunggal.
function extractMessageText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(extractMessageText).join('')
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.content === 'string') return obj.content
  }
  return ''
}

export interface AiParseOutcome {
  result: AiResult | null
  finishReason: string
  rawText: string
}

// Ekstrak hasil analisis dari respons Chat Completions mentah. Sumber teks
// utama adalah message.content; bila kosong atau tidak terparse, coba
// message.reasoning (beberapa model reasoning menaruh jawaban di sana).
export function parseAiResponse(data: unknown): AiParseOutcome {
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const choices = Array.isArray(root.choices) ? root.choices : []
  const first =
    choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : {}
  const message =
    first.message && typeof first.message === 'object'
      ? (first.message as Record<string, unknown>)
      : {}
  const finishReason = typeof first.finish_reason === 'string' ? first.finish_reason : ''
  const contentText = extractMessageText(message.content)
  const reasoningText = extractMessageText(message.reasoning)

  let result = contentText ? parseAiJson(contentText) : null
  if (!result && reasoningText) result = parseAiJson(reasoningText)
  return { result, finishReason, rawText: contentText || reasoningText }
}

// --- Mode streaming -------------------------------------------------------
// Sebagian provider menaruh penalaran di delta.reasoning_details sebagai
// array bagian ({type:"reasoning.text", text:"..."} / {summary:"..."}).
// Bagian terenkripsi (tanpa teks) dilewati.
function extractReasoningDetailsText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  let out = ''
  for (const item of value) {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      if (typeof obj.text === 'string') out += obj.text
      else if (typeof obj.summary === 'string') out += obj.summary
    }
  }
  return out
}

const THINK_OPEN_TAGS = ['<thinking>', '<think>']
const THINK_CLOSE_TAGS = ['</thinking>', '</think>']

// Memisahkan teks content yang masuk bertahap menjadi penalaran (teks di
// dalam blok <think>...</think>) dan konten jawaban. Aman terhadap tag yang
// terpotong tepat di batas potongan aliran: ekor buffer yang mungkin awalan
// tag ditahan sampai potongan berikutnya tiba.
class ThinkSplitter {
  private buffer = ''
  private inThink = false

  push(chunk: string): { reasoning: string; content: string } {
    this.buffer += chunk
    return this.drain(false)
  }

  flush(): { reasoning: string; content: string } {
    return this.drain(true)
  }

  private drain(final: boolean): { reasoning: string; content: string } {
    let reasoning = ''
    let content = ''
    for (;;) {
      const tags = this.inThink ? THINK_CLOSE_TAGS : THINK_OPEN_TAGS
      const lower = this.buffer.toLowerCase()
      let tagStart = -1
      let tagLength = 0
      for (const tag of tags) {
        const idx = lower.indexOf(tag)
        if (idx >= 0 && (tagStart < 0 || idx < tagStart)) {
          tagStart = idx
          tagLength = tag.length
        }
      }
      if (tagStart >= 0) {
        const before = this.buffer.slice(0, tagStart)
        if (this.inThink) reasoning += before
        else content += before
        this.buffer = this.buffer.slice(tagStart + tagLength)
        this.inThink = !this.inThink
        continue
      }
      if (final) {
        if (this.inThink) reasoning += this.buffer
        else content += this.buffer
        this.buffer = ''
      } else {
        const hold = this.partialTagSuffixLength(tags)
        const cut = this.buffer.length - hold
        if (this.inThink) reasoning += this.buffer.slice(0, cut)
        else content += this.buffer.slice(0, cut)
        this.buffer = this.buffer.slice(cut)
      }
      break
    }
    return { reasoning, content }
  }

  // Panjang sufiks buffer yang merupakan awalan (belum utuh) salah satu tag.
  private partialTagSuffixLength(tags: string[]): number {
    const lower = this.buffer.toLowerCase()
    let max = 0
    for (const tag of tags) {
      for (let len = 1; len < tag.length && len <= lower.length; len++) {
        if (lower.endsWith(tag.slice(0, len))) max = Math.max(max, len)
      }
    }
    return max
  }
}

interface StreamOptions {
  apiKey: string
  model: string
  cvText: string
  targetRole: string
  jobDesc: string
}

// Menjalankan analisis dalam mode streaming: meneruskan penalaran model
// sebagai event NDJSON begitu tiba, lalu satu event hasil di akhir.
// Semua error SEBELUM aliran dimulai (key, upstream HTTP, timeout awal)
// sudah ditangani pemanggil / fase fetch di sini dengan respons JSON biasa;
// fungsi ini hanya dipanggil setelah validasi lolos dan aliran adalah
// satu-satunya keluaran yang tersisa untuk kegagalan di tengah proses.
async function streamAnalysis(res: AiResponse, opts: StreamOptions): Promise<void> {
  const { apiKey, model, cvText, targetRole, jobDesc } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  const sendRequest = async (options: {
    withResponseFormat: boolean
    withReasoning: boolean
  }): Promise<Response> => {
    try {
      return await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Title': 'Screening CV',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(cvText, targetRole, jobDesc) },
          ],
          stream: true,
          ...(options.withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
          // Effort "medium" khusus jalur streaming: cukup berpikir untuk
          // ditampilkan, tanpa menghabiskan seluruh jatah token.
          ...(options.withReasoning ? { reasoning: { effort: 'medium' } } : {}),
          temperature: 0.4,
          max_tokens: STREAM_MAX_TOKENS,
        }),
      })
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new UpstreamTimeoutError()
      }
      throw err
    }
  }

  const readErrMessage = async (response: Response): Promise<string> => {
    try {
      const errData = (await response.json()) as {
        error?: { code?: number | string; message?: string }
      }
      return (errData.error?.message ?? '').slice(0, 300)
    } catch {
      return ''
    }
  }

  // --- Fase fetch: aliran belum dimulai, error dibalas JSON biasa ---
  let aiResponse: Response
  let upstreamMessage: string | null = null
  let includeResponseFormat = true
  let includeReasoning = true
  try {
    aiResponse = await sendRequest({
      withResponseFormat: includeResponseFormat,
      withReasoning: includeReasoning,
    })
    // Penolakan parameter opsional (400) ditangani sama seperti mode biasa:
    // buang parameter yang ditolak, ulangi maksimal 2 kali.
    for (let retry = 0; retry < 2 && !aiResponse.ok && aiResponse.status === 400; retry++) {
      const message400 = await readErrMessage(aiResponse)
      const lower = message400.toLowerCase()
      let dropped = false
      if (includeReasoning && lower.includes('reasoning')) {
        includeReasoning = false
        dropped = true
      } else if (includeResponseFormat && /response_format|\bjson\b/.test(lower)) {
        includeResponseFormat = false
        dropped = true
      } else if (/unsupported|not supported|unknown|invalid parameter/.test(lower)) {
        if (includeReasoning) {
          includeReasoning = false
          dropped = true
        } else if (includeResponseFormat) {
          includeResponseFormat = false
          dropped = true
        }
      }
      if (!dropped) {
        upstreamMessage = message400
        break
      }
      aiResponse = await sendRequest({
        withResponseFormat: includeResponseFormat,
        withReasoning: includeReasoning,
      })
    }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof UpstreamTimeoutError) {
      console.error(`[analyze-ai] (stream) Timeout ${STREAM_TIMEOUT_MS / 1000} detik menunggu OpenRouter`)
      res.status(502).json({
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
        detail: 'Timeout 120 detik menunggu OpenRouter (streaming)',
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  if (!aiResponse.ok) {
    clearTimeout(timer)
    const message = upstreamMessage ?? (await readErrMessage(aiResponse))
    const detail = `OpenRouter HTTP ${aiResponse.status}${message ? `: ${message}` : ''}`
    console.error(`[analyze-ai] (stream) ${detail}`)
    if (aiResponse.status === 429) {
      res.status(429).json({
        error: 'Layanan AI sedang dibatasi (rate limit) atau kuota gratis sedang penuh, coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    if (aiResponse.status === 401 || aiResponse.status === 403) {
      res.status(502).json({
        error: 'API key OpenRouter ditolak. Periksa konfigurasi OPENROUTER_API_KEY di server — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    if (aiResponse.status === 402) {
      res.status(502).json({
        error: 'Kredit OpenRouter tidak cukup untuk menjalankan analisis AI. Isi kredit atau periksa batas pemakaian akun OpenRouter — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
    return
  }

  const reader = aiResponse.body?.getReader()
  if (!reader) {
    clearTimeout(timer)
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      detail: 'OpenRouter tidak mengirim aliran data (stream kosong).',
    })
    return
  }

  // --- Fase aliran: keluaran menjadi NDJSON, satu event per baris ---
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  res.status(200)
  const send = (event: Record<string, unknown>) => {
    try {
      res.write?.(`${JSON.stringify(event)}\n`)
    } catch {
      // Klien terputus; abaikan — pembacaan upstream dihentikan di catch.
    }
  }

  const splitter = new ThinkSplitter()
  let reasoningAll = ''
  let contentAll = ''
  let finishReason = ''
  let streamError: { error: string; detail: string } | null = null

  const emitReasoning = (text: string) => {
    if (!text) return
    reasoningAll += text
    send({ type: 'reasoning', text })
  }
  const emitContent = (chunk: string) => {
    const split = splitter.push(chunk)
    emitReasoning(split.reasoning)
    contentAll += split.content
  }

  try {
    const decoder = new TextDecoder()
    let buffer = ''
    let upstreamDone = false
    while (!upstreamDone) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        nl = buffer.indexOf('\n')
        if (!line.startsWith('data:')) continue
        const dataStr = line.slice('data:'.length).trim()
        if (!dataStr) continue
        if (dataStr === '[DONE]') {
          upstreamDone = true
          break
        }
        let chunkJson: Record<string, unknown>
        try {
          chunkJson = JSON.parse(dataStr) as Record<string, unknown>
        } catch {
          continue
        }
        if (chunkJson.error && typeof chunkJson.error === 'object') {
          const errObj = chunkJson.error as Record<string, unknown>
          const msg = asString(errObj.message).slice(0, 300)
          streamError = {
            error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
            detail: `OpenRouter${msg ? `: ${msg}` : ''}`,
          }
          upstreamDone = true
          break
        }
        const choices = Array.isArray(chunkJson.choices) ? chunkJson.choices : []
        const choice =
          choices[0] && typeof choices[0] === 'object'
            ? (choices[0] as Record<string, unknown>)
            : null
        if (!choice) continue
        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
          finishReason = choice.finish_reason
        }
        const delta =
          choice.delta && typeof choice.delta === 'object'
            ? (choice.delta as Record<string, unknown>)
            : {}
        // Sebagian provider (mis. Nemotron via OpenRouter) mengirim teks
        // penalaran yang SAMA di delta.reasoning dan delta.reasoning_details
        // sekaligus — menggabungkan keduanya membuat panel berpikir berisi
        // teks dobel. Utamakan delta.reasoning; reasoning_details hanya
        // dipakai bila field reasoning kosong.
        const reasoningText =
          extractMessageText(delta.reasoning) || extractReasoningDetailsText(delta.reasoning_details)
        emitReasoning(reasoningText)
        const contentChunk = extractMessageText(delta.content)
        if (contentChunk) emitContent(contentChunk)
      }
    }
  } catch (err) {
    if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      streamError = {
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
        detail: 'Timeout 120 detik menunggu OpenRouter (streaming)',
      }
    } else if (!streamError) {
      streamError = {
        error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
        detail: 'Aliran data dari OpenRouter terputus di tengah proses.',
      }
    }
  } finally {
    clearTimeout(timer)
  }

  // Sisa splitter (tag tidak ditutup / potongan terakhir) tetap diproses.
  const rest = splitter.flush()
  if (!streamError) emitReasoning(rest.reasoning)
  else reasoningAll += rest.reasoning
  contentAll += rest.content

  if (streamError) {
    console.error(`[analyze-ai] (stream) ${streamError.detail}`)
    send({ type: 'error', error: streamError.error, detail: streamError.detail })
    res.end?.()
    return
  }

  let result = contentAll ? parseAiJson(contentAll) : null
  if (!result && reasoningAll) result = parseAiJson(reasoningAll)
  if (result) {
    send({ type: 'result', data: result })
  } else {
    const rawText = contentAll || reasoningAll
    const snippet = rawText.slice(0, 200)
    const detail =
      `finish_reason: ${finishReason || 'tidak tersedia'}; ` +
      `panjang teks mentah: ${rawText.length} karakter; ` +
      `cuplikan awal jawaban model: ${snippet ? `"${snippet}"` : '(kosong)'}`
    console.error(
      `[analyze-ai] (stream) Jawaban model tidak terparse (finish_reason=${finishReason || '-'}, panjang=${rawText.length})`,
    )
    send({
      type: 'error',
      error: 'Jawaban AI tidak bisa dibaca. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
  }
  res.end?.()
}

export default async function handler(req: AiRequest, res: AiResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' })
    return
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({
      error: 'Terlalu banyak permintaan analisis AI dari koneksimu. Tunggu beberapa menit lalu coba lagi.',
    })
    return
  }

  // Body: Vercel biasanya sudah mem-parse JSON; bila masih string, parse manual.
  let payload: Record<string, unknown> = {}
  if (typeof req.body === 'string') {
    try {
      payload = JSON.parse(req.body) as Record<string, unknown>
    } catch {
      res.status(400).json({ error: 'Format data tidak valid (bukan JSON).' })
      return
    }
  } else if (req.body && typeof req.body === 'object') {
    payload = req.body as Record<string, unknown>
  } else {
    res.status(400).json({ error: 'Data permintaan kosong atau tidak valid.' })
    return
  }

  const cvText = asString(payload.cvText).trim()
  const targetRole = asString(payload.targetRole).trim().slice(0, MAX_ROLE_CHARS)
  const jobDesc = asString(payload.jobDesc).trim()

  if (cvText.length < MIN_CV_CHARS) {
    res.status(400).json({
      error: `Teks CV terlalu pendek (minimal ${MIN_CV_CHARS} karakter). Upload atau tempel CV yang lengkap dulu.`,
    })
    return
  }
  if (cvText.length > MAX_CV_CHARS) {
    res.status(400).json({
      error: `Teks CV terlalu panjang (maksimal ${MAX_CV_CHARS.toLocaleString('id-ID')} karakter). Persingkat dulu, misalnya hanya bagian utama CV.`,
    })
    return
  }
  if (jobDesc.length > MAX_JOBDESC_CHARS) {
    res.status(400).json({
      error: `Deskripsi lowongan terlalu panjang (maksimal ${MAX_JOBDESC_CHARS.toLocaleString('id-ID')} karakter). Persingkat dulu.`,
    })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: 'Fitur Analisis AI belum aktif: OPENROUTER_API_KEY belum terpasang di server.',
    })
    return
  }
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free'

  // Mode streaming (body memuat "stream": true): proses berpikir model
  // diteruskan langsung ke browser sebagai event NDJSON. Semua validasi,
  // rate limit, dan pemeriksaan key di atas sudah berjalan sama seperti
  // mode biasa — error sebelum aliran dimulai dibalas JSON biasa.
  if (payload.stream === true) {
    await streamAnalysis(res, { apiKey, model, cvText, targetRole, jobDesc })
    return
  }

  const sendRequest = async (options: {
    withResponseFormat: boolean
    withReasoning: boolean
  }): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Title': 'Screening CV',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(cvText, targetRole, jobDesc) },
          ],
          ...(options.withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
          // Model reasoning bisa menghabiskan seluruh jatah token hanya
          // untuk berpikir (kejadian sebelumnya: penalaran 12 ribu karakter
          // memenuhi content dan JSON tidak pernah selesai). Batasi
          // effort-nya agar jawaban JSON sempat ditulis.
          ...(options.withReasoning ? { reasoning: { effort: 'low' } } : {}),
          temperature: 0.4,
          // 3000 token agar JSON jawaban tidak terpotong batas default provider.
          max_tokens: 3000,
        }),
      })
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        throw new UpstreamTimeoutError()
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  const readUpstreamMessage = async (response: Response): Promise<string> => {
    try {
      const errData = (await response.json()) as {
        error?: { code?: number | string; message?: string }
      }
      return (errData.error?.message ?? '').slice(0, 300)
    } catch {
      return ''
    }
  }

  let aiResponse: Response
  let upstreamMessage: string | null = null
  let includeResponseFormat = true
  let includeReasoning = true
  try {
    aiResponse = await sendRequest({
      withResponseFormat: includeResponseFormat,
      withReasoning: includeReasoning,
    })
    // Sebagian model menolak parameter opsional (reasoning / response_format).
    // Bila error 400 menyebut parameter yang tidak didukung, buang parameter
    // yang ditolak lalu ulangi — maksimal 2 kali pengulangan, satu jenis
    // parameter dibuang tiap kali. Error 400 lain tidak diulang dan tetap
    // dipetakan seperti biasa.
    for (let retry = 0; retry < 2 && !aiResponse.ok && aiResponse.status === 400; retry++) {
      const message400 = await readUpstreamMessage(aiResponse)
      const lower = message400.toLowerCase()
      let dropped = false
      if (includeReasoning && lower.includes('reasoning')) {
        includeReasoning = false
        dropped = true
      } else if (includeResponseFormat && /response_format|\bjson\b/.test(lower)) {
        includeResponseFormat = false
        dropped = true
      } else if (/unsupported|not supported|unknown|invalid parameter/.test(lower)) {
        // Parameter ditolak tanpa disebut namanya: buang reasoning dulu,
        // lalu response_format pada pengulangan berikutnya.
        if (includeReasoning) {
          includeReasoning = false
          dropped = true
        } else if (includeResponseFormat) {
          includeResponseFormat = false
          dropped = true
        }
      }
      if (!dropped) {
        upstreamMessage = message400
        break
      }
      aiResponse = await sendRequest({
        withResponseFormat: includeResponseFormat,
        withReasoning: includeReasoning,
      })
    }
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      console.error(`[analyze-ai] Timeout ${UPSTREAM_TIMEOUT_MS / 1000} detik menunggu OpenRouter`)
      res.status(502).json({
        error: 'Layanan AI terlalu lama merespons. Coba lagi — hasil analisis standar tetap bisa dipakai.',
        detail: 'Timeout 55 detik menunggu OpenRouter',
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI sedang tidak bisa dihubungi. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
    })
    return
  }

  if (!aiResponse.ok) {
    // Diagnosis: sertakan status HTTP + pesan error resmi OpenRouter pada
    // field "detail" dan log server, agar penyebab 502 terlihat. Yang
    // disertakan hanya status dan pesan OpenRouter — TIDAK termasuk API key,
    // header, atau isi CV/permintaan.
    const message = upstreamMessage ?? (await readUpstreamMessage(aiResponse))
    const detail = `OpenRouter HTTP ${aiResponse.status}${message ? `: ${message}` : ''}`
    console.error(`[analyze-ai] ${detail}`)

    if (aiResponse.status === 429) {
      res.status(429).json({
        error: 'Layanan AI sedang dibatasi (rate limit) atau kuota gratis sedang penuh, coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    if (aiResponse.status === 401 || aiResponse.status === 403) {
      res.status(502).json({
        error: 'API key OpenRouter ditolak. Periksa konfigurasi OPENROUTER_API_KEY di server — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    if (aiResponse.status === 402) {
      res.status(502).json({
        error: 'Kredit OpenRouter tidak cukup untuk menjalankan analisis AI. Isi kredit atau periksa batas pemakaian akun OpenRouter — hasil analisis standar tetap bisa dipakai.',
        detail,
      })
      return
    }
    res.status(502).json({
      error: 'Layanan AI mengembalikan kesalahan. Coba lagi nanti — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
    return
  }

  let data: unknown = null
  try {
    data = await aiResponse.json()
  } catch {
    data = null
  }

  const parsed = parseAiResponse(data)
  if (!parsed.result) {
    // Diagnostik parse: sertakan finish_reason, panjang teks mentah, dan
    // cuplikan awal jawaban model pada field "detail" agar kegagalan bisa
    // didiagnosis. Cuplikan berasal dari JAWABAN model atas CV pemanggil
    // sendiri (bukan input CV mentah) dan hanya muncul pada mode gagal
    // parse; isi CV tetap tidak dicatat ke log.
    const snippet = parsed.rawText.slice(0, 200)
    const detail =
      `finish_reason: ${parsed.finishReason || 'tidak tersedia'}; ` +
      `panjang teks mentah: ${parsed.rawText.length} karakter; ` +
      `cuplikan awal jawaban model: ${snippet ? `"${snippet}"` : '(kosong)'}`
    console.error(
      `[analyze-ai] Jawaban model tidak terparse (finish_reason=${parsed.finishReason || '-'}, panjang=${parsed.rawText.length})`,
    )
    res.status(502).json({
      error: 'Jawaban AI tidak bisa dibaca. Coba lagi — hasil analisis standar tetap bisa dipakai.',
      detail,
    })
    return
  }

  res.status(200).json(parsed.result)
}
