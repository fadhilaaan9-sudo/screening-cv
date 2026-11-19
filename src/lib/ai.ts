// Klien untuk backend Analisis AI (POST /api/analyze-ai → OpenRouter).
// Dipakai hanya bila pengguna mencentang persetujuan pengiriman teks CV.

import type { AnalysisResult } from './analyze'

export interface AiRewrite {
  asli: string
  saran: string
  alasan: string
}

export interface AiAnalysis {
  ringkasan: string
  saranPenulisanUlang: AiRewrite[]
  kekurangan: string[]
  saranUntukLowongan: string
}

export interface AiRequestInput {
  cvText: string
  targetRole?: string
  jobDesc?: string
  rule?: RuleContext
}
export interface RuleEvidenceContext {
  title: string
  score: number
  reasons: string[]
}

export interface RuleContext {
  readyScore: number
  readyLabel: string
  mode: string
  aspects: { name: string; score: number; max: number }[]
  weakestEvidence: RuleEvidenceContext[]
  priorities: string[]
}

/** Ringkas hasil penilaian rule-based untuk dikirim sebagai konteks ke AI. */
export function buildRuleContext(result: AnalysisResult): RuleContext {
  const weakestEvidence = [...result.allEvidence]
    .filter((e) => e.bullets.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((e) => ({ title: e.title, score: e.score, reasons: e.reasons }))
  return {
    readyScore: result.readyScore,
    readyLabel: result.readyLabel,
    mode: result.mode === 'fresh' ? 'Fresh Graduate' : 'Berpengalaman',
    aspects: result.aspects.map((a) => ({ name: a.name, score: a.score, max: a.max })),
    weakestEvidence,
    priorities: result.priorities.map((c) => `${c.title} (${c.score}/${c.max}): ${c.message}`),
  }
}

export async function requestAiAnalysis(input: AiRequestInput): Promise<AiAnalysis> {
  let response: Response
  try {
    response = await fetch('/api/analyze-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Tidak bisa menghubungi server Analisis AI. Periksa koneksimu lalu coba lagi.')
  }

  if (response.status === 404) {
    throw new Error(
      'Endpoint Analisis AI tidak ditemukan. Kamu menjalankan "npm run dev" (hanya website, tanpa server AI). Jalankan "npm run dev:ai" agar AI jalan di lokal.',
    )
  }

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Analisis AI gagal. Coba lagi nanti.'
    throw new Error(message)
  }

  if (!data || typeof data !== 'object') {
    throw new Error(
      'Server Analisis AI tidak membalas JSON. Kamu mungkin menjalankan "npm run dev" (tanpa server AI) — jalankan "npm run dev:ai".',
    )
  }

  return data as AiAnalysis
}

export interface AiStreamHandlers {
  // Dipanggil untuk setiap potongan penalaran model yang tiba.
  onReasoning: (text: string) => void
  // Dipanggil untuk setiap event aliran yang diterima (reasoning/result/
  // error) — penanda bahwa aliran benar-benar sudah berjalan.
  onActivity?: () => void
}

// Mode streaming: server meneruskan proses berpikir model sebagai event
// NDJSON (satu JSON per baris): {"type":"reasoning"}, {"type":"result"},
// {"type":"error"}. Error sebelum aliran dimulai dibalas server sebagai
// JSON biasa dengan status HTTP non-200, sama seperti mode non-streaming.
export async function requestAiAnalysisStreaming(
  input: AiRequestInput,
  handlers: AiStreamHandlers,
): Promise<AiAnalysis> {
  let response: Response
  try {
    response = await fetch('/api/analyze-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, stream: true }),
    })
  } catch {
    throw new Error('Tidak bisa menghubungi server Analisis AI. Periksa koneksimu lalu coba lagi.')
  }

  if (response.status === 404) {
    throw new Error(
      'Endpoint Analisis AI tidak ditemukan. Kamu menjalankan "npm run dev" (hanya website, tanpa server AI). Jalankan "npm run dev:ai" agar AI jalan di lokal.',
    )
  }

  if (!response.ok) {
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Analisis AI gagal. Coba lagi nanti.'
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('Browser tidak mendukung penerimaan aliran data. Coba browser lain.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: AiAnalysis | null = null
  let streamError: Error | null = null

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      return
    }
    handlers.onActivity?.()
    if (event.type === 'reasoning' && typeof event.text === 'string') {
      handlers.onReasoning(event.text)
    } else if (event.type === 'result') {
      result = event.data as AiAnalysis
    } else if (event.type === 'error') {
      streamError = new Error(
        typeof event.error === 'string' ? event.error : 'Analisis AI gagal. Coba lagi nanti.',
      )
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl = buffer.indexOf('\n')
    while (nl >= 0) {
      handleLine(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
      nl = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) handleLine(buffer)

  if (streamError) throw streamError
  if (!result) {
    throw new Error('Aliran analisis AI terputus sebelum hasil diterima. Coba lagi.')
  }
  return result
}
