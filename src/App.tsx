import { useEffect, useRef, useState } from 'react'
import './App.css'
import { analyzeCv, countWords, type AnalysisResult, type CandidateMode, type CheckItem } from './lib/analyze'
import { requestAiAnalysis, requestAiAnalysisStreaming, type AiAnalysis } from './lib/ai'
import { SAMPLE_CV } from './lib/sampleCv'
import { extractTextFromFile } from './lib/readFile'

// ---------- Ikon SVG inline ----------
function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const I = {
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  chart: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
  check: 'M20 6L9 17l-5-5',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  copy: 'M8 8h14v14H8zM4 4h14v14H4z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  target: 'M12 12h.01M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
}

// ---------- Ring skor beranimasi ----------
function ScoreRing({ score, size = 150 }: { score: number; size?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(score * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])
  const r = 52
  const c = 2 * Math.PI * r
  const color = score >= 85 ? '#16a34a' : score >= 70 ? '#0ea5e9' : score >= 50 ? '#f59e0b' : '#dc2626'
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (display / 100) * c}
          transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring-center">
        <span className="ring-num">{display}</span>
        <span className="ring-max">/ 100</span>
      </div>
    </div>
  )
}

function CheckRow({ check }: { check: CheckItem }) {
  return (
    <li className={`check-row status-${check.status}`}>
      <span className="check-icon">
        {check.status === 'baik' ? <Icon d={I.check} size={15} /> : <Icon d={I.alert} size={15} />}
      </span>
      <div className="check-body">
        <div className="check-head">
          <strong>{check.title}</strong>
          <span className="check-meta">{check.aspect} • {check.score}/{check.max} poin</span>
        </div>
        <p>{check.message}</p>
      </div>
    </li>
  )
}

const ATS_TIPS = [
  'Gunakan heading standar yang mudah dikenali sistem ATS: Ringkasan, Pengalaman, Magang, Proyek, Pendidikan, Keahlian.',
  'Tulis pencapaian dengan angka: persen, jumlah orang/proyek, atau nominal — bukan hanya daftar tugas.',
  'Mulai setiap poin pengalaman dengan kata kerja aksi, misalnya meningkatkan, mengelola, membangun.',
  'Samakan kata kunci penting dari deskripsi lowongan dengan isi CV-mu secara jujur.',
  'Jaga panjang CV di kisaran 220–900 kata (1–2 halaman) dan susun dengan bullet yang rapi.',
  'Cantumkan kontak lengkap: email, nomor HP, LinkedIn, dan link karya.',
]

export default function App() {
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [mode, setMode] = useState<CandidateMode>('fresh')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiThinking, setAiThinking] = useState('')
  const [aiThinkingOpen, setAiThinkingOpen] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [aiDuration, setAiDuration] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const aiStartRef = useRef(0)
  const thinkingBodyRef = useRef<HTMLDivElement>(null)

  // Penghitung detik berjalan selama analisis AI berlangsung.
  useEffect(() => {
    if (!aiLoading) return
    const id = window.setInterval(() => {
      setAiElapsed(Math.floor((Date.now() - aiStartRef.current) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [aiLoading])

  // Panel proses berpikir selalu bergulir mengikuti teks terbaru.
  useEffect(() => {
    const el = thinkingBodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [aiThinking, aiThinkingOpen])

  async function handleFile(file: File) {
    setError('')
    setLoadingFile(true)
    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        setError('Teks dari file kosong. Jika PDF hasil scan/gambar, tempel teks CV secara manual.')
      } else {
        setCvText(text)
        setFileName(file.name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membaca file.')
    } finally {
      setLoadingFile(false)
    }
  }

  function handleAnalyze() {
    setError('')
    if (cvText.trim().length < 20) {
      setError('Teks CV masih terlalu pendek. Upload file CV atau tempel teks CV terlebih dahulu.')
      return
    }
    setResult(analyzeCv(cvText, { targetRole, jobDesc, mode }))
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleSample() {
    setCvText(SAMPLE_CV)
    setMode('experienced')
    setFileName('')
    setError('')
  }

  function handleReset() {
    setCvText('')
    setTargetRole('')
    setJobDesc('')
    setMode('fresh')
    setResult(null)
    setFileName('')
    setError('')
    setCopied(false)
    setAiConsent(false)
    setAiResult(null)
    setAiError('')
    setAiThinking('')
    setAiThinkingOpen(false)
    setAiElapsed(0)
    setAiDuration(null)
  }

  async function handleAiAnalyze() {
    if (!aiConsent || aiLoading) return
    if (cvText.trim().length < 50) {
      setAiError('Teks CV terlalu pendek untuk dianalisis AI. Lengkapi dulu teks CV-nya.')
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiThinking('')
    setAiThinkingOpen(false)
    setAiDuration(null)
    setAiElapsed(0)
    aiStartRef.current = Date.now()
    const input = { cvText, targetRole, jobDesc }
    let receivedEvent = false
    try {
      const data = await requestAiAnalysisStreaming(input, {
        onActivity: () => {
          receivedEvent = true
        },
        onReasoning: (text) => {
          setAiThinking((prev) => {
            if (prev.length >= 8000) return prev
            const next = prev + text
            return next.length > 8000 ? `${next.slice(0, 8000)}…` : next
          })
        },
      })
      setAiResult(data)
    } catch (streamErr) {
      if (!receivedEvent) {
        // Streaming gagal sebelum event pertama (jaringan/HTTP error):
        // coba sekali mode non-streaming sebagai cadangan.
        try {
          const data = await requestAiAnalysis(input)
          setAiResult(data)
        } catch (fallbackErr) {
          setAiError(
            fallbackErr instanceof Error ? fallbackErr.message : 'Analisis AI gagal. Coba lagi nanti.',
          )
        }
      } else {
        setAiError(streamErr instanceof Error ? streamErr.message : 'Analisis AI gagal. Coba lagi nanti.')
      }
    } finally {
      setAiDuration(Math.max(1, Math.round((Date.now() - aiStartRef.current) / 1000)))
      setAiLoading(false)
    }
  }

  async function handleCopyReport() {
    if (!result) return
    const lines: string[] = [
      `HASIL SCREENING CV`,
      `Mode: ${result.mode === 'fresh' ? 'Fresh Graduate' : 'Berpengalaman'}`,
      `Skor Siap: ${result.readyScore}/100 — ${result.readyLabel}`,
      ...(result.matchScore !== null
        ? [`Skor Cocok: ${result.matchScore}/100 — ${result.matchLabel ?? ''}`]
        : ['Skor Cocok: - (isi posisi target / deskripsi lowongan)']),
      `Total kata: ${result.wordCount}`,
      '',
      'SKOR PER ASPEK:',
      ...result.aspects.map((a) => `- ${a.name}: ${a.score}/${a.max}`),
      '',
      'BUKTI TERBAIK (STAR):',
      ...(result.topEvidence.length
        ? result.topEvidence.map((e) => `- ${e.title} — ${e.score}/10`)
        : ['- (belum ada)']),
      '',
      'KEKUATAN:',
      ...(result.strengths.length
        ? result.strengths.map((c) => `- ${c.title}: ${c.message}`)
        : ['- (belum ada)']),
      '',
      'PRIORITAS PERBAIKAN:',
      ...(result.priorities.length
        ? result.priorities.map((c) => `- ${c.title} (${c.score}/${c.max}): ${c.message}`)
        : ['- Tidak ada, semua pemeriksaan lolos.']),
    ]
    if (result.keywords) {
      lines.push('', `KECOCOKAN KATA KUNCI LOWONGAN: ${result.keywords.percent}% ditemukan di bukti`)
      lines.push(`Di bukti: ${result.keywords.inEvidence.join(', ') || '-'}`)
      lines.push(`Hanya klaim: ${result.keywords.inCvOnly.join(', ') || '-'}`)
      lines.push(`Belum ada: ${result.keywords.missing.join(', ') || '-'}`)
    }
    if (result.roleWarning) lines.push('', `CATATAN POSISI: ${result.roleWarning}`)
    if (result.modeNote) lines.push('', `CATATAN MODE: ${result.modeNote}`)
    if (result.consistencyWarnings.length > 0) {
      lines.push('', 'PERINGATAN KONSISTENSI:')
      for (const w of result.consistencyWarnings) lines.push(`- ${w}`)
    }
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      {/* ===== HERO ===== */}
      <header className="hero">
        <div className="hero-inner">
          <span className="badge"><Icon d={I.zap} size={14} /> Penilaian CV Bahasa Indonesia</span>
          <h1>Screening CV</h1>
          <p className="hero-sub">
            Masukkan CV-mu, dapatkan Skor Siap 0–95 dan — bila ada lowongan — Skor Cocok
            dengan lowongan itu. Skor dihitung dari bukti (magang, proyek, organisasi,
            pengalaman kerja), bukan dari jumlah kata. Setiap poin disertai alasannya.
            Analisis standar berjalan 100% di browser — file CV tidak diunggah ke server mana pun.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#analisis"><Icon d={I.chart} size={18} /> Mulai Analisis</a>
            <button className="btn btn-ghost" type="button" onClick={handleSample}>
              <Icon d={I.file} size={18} /> Coba CV Contoh
            </button>
          </div>
          <div className="hero-stats">
            <div><strong>95</strong><span>skor tertinggi realistis</span></div>
            <div><strong>6</strong><span>aspek dinilai</span></div>
            <div><strong>3</strong><span>bukti terbaik dihitung</span></div>
          </div>
        </div>
      </header>

      {/* ===== CARA KERJA ===== */}
      <section className="steps">
        <div className="step-card">
          <span className="step-num">1</span>
          <Icon d={I.upload} size={22} />
          <h3>Pilih mode & masukkan CV</h3>
          <p>Pilih Fresh Graduate atau Berpengalaman, lalu upload PDF, DOCX, atau TXT — atau tempel teks CV langsung di form.</p>
        </div>
        <div className="step-card">
          <span className="step-num">2</span>
          <Icon d={I.target} size={22} />
          <h3>Isi posisi & lowongan</h3>
          <p>Opsional: posisi target dan deskripsi lowongan untuk mengaktifkan Skor Cocok.</p>
        </div>
        <div className="step-card">
          <span className="step-num">3</span>
          <Icon d={I.list} size={22} />
          <h3>Lihat dua skor & perbaiki</h3>
          <p>Skor Siap dan Skor Cocok, bukti STAR terbaikmu, dan prioritas perbaikan yang terurut.</p>
        </div>
      </section>

      {/* ===== LAYOUT UTAMA ===== */}
      <main className="layout" id="analisis">
        {/* ----- FORM ----- */}
        <section className="card form-card">
          <h2><Icon d={I.file} size={20} /> Data CV</h2>

          <div
            className={`dropzone${dragging ? ' dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void handleFile(f)
            }}
            role="button"
            tabIndex={0}
          >
            <Icon d={I.upload} size={26} />
            <p><strong>Tarik & letakkan file CV di sini</strong><br />atau klik untuk memilih file (PDF, DOCX, TXT)</p>
            {fileName && <span className="file-name">{fileName}</span>}
            {loadingFile && <span className="file-name">Membaca file…</span>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />

          <label className="field">
            <span>Status kamu</span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className={`btn ${mode === 'fresh' ? 'btn-primary' : 'btn-secondary'}`}
                type="button"
                onClick={() => setMode('fresh')}
              >
                Fresh Graduate
              </button>
              <button
                className={`btn ${mode === 'experienced' ? 'btn-primary' : 'btn-secondary'}`}
                type="button"
                onClick={() => setMode('experienced')}
              >
                Berpengalaman
              </button>
            </span>
            <small className="counter">
              {mode === 'fresh'
                ? 'Magang, proyek, organisasi, dan tugas akhir ikut dinilai sebagai bukti.'
                : 'Pengalaman kerja jadi sumber bukti utama; magang dan proyek tetap diakui.'}
            </small>
          </label>

          <label className="field">
            <span>Teks CV</span>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder={'Tempel teks CV di sini, atau upload file di atas.\n\nContoh format kontak yang terbaca:\nemail@contoh.com | +62 812-3456-7890 | linkedin.com/in/namamu | github.com/namamu'}
              rows={12}
            />
            <small className="counter">{cvText.length} karakter • {countWords(cvText)} kata</small>
          </label>

          <label className="field">
            <span>Posisi yang dilamar (opsional)</span>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Mis. Data Analyst"
            />
          </label>

          <label className="field">
            <span>Deskripsi lowongan (opsional)</span>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Tempel deskripsi lowongan untuk mengaktifkan Skor Cocok dengan lowongan itu."
              rows={5}
            />
          </label>

          {error && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {error}</div>}

          <div className="form-actions">
            <button className="btn btn-primary" type="button" onClick={handleAnalyze}>
              <Icon d={I.search} size={18} /> Analisis CV
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleSample}>
              Coba CV Contoh
            </button>
            <button className="btn btn-plain" type="button" onClick={handleReset}>
              <Icon d={I.refresh} size={16} /> Reset
            </button>
          </div>
        </section>

        {/* ----- HASIL ----- */}
        <section className="result-col" ref={resultRef}>
          {!result ? (
            <div className="card empty-card">
              <span className="badge badge-soft">Contoh hasil — ilustrasi</span>
              <div className="empty-flex">
                <ScoreRing score={78} size={130} />
                <div>
                  <h3>Seperti ini tampilan hasilmu nanti</h3>
                  <p>
                    Skor Siap dan Skor Cocok, rincian per aspek beserta alasannya, bukti STAR
                    terbaikmu, daftar kekuatan, prioritas perbaikan, dan cek kata kunci lowongan.
                    Isi form di samping lalu klik <strong>Analisis CV</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="card result-card">
                <div className="result-top">
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'center' }}>
                      <ScoreRing score={result.readyScore} />
                      <p style={{ marginTop: 8, fontWeight: 700 }}>Skor Siap</p>
                    </div>
                    {result.matchScore !== null ? (
                      <div style={{ textAlign: 'center' }}>
                        <ScoreRing score={result.matchScore} />
                        <p style={{ marginTop: 8, fontWeight: 700 }}>Skor Cocok</p>
                      </div>
                    ) : (
                      <div style={{ maxWidth: 220, textAlign: 'left', paddingTop: 24 }}>
                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                          <strong>Skor Cocok</strong> belum ada. Isi posisi target atau deskripsi
                          lowongan, lalu analisis ulang untuk melihat seberapa cocok CV-mu dengan
                          lowongan itu.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="result-summary">
                    <span className="badge badge-soft">Hasil analisis • {result.mode === 'fresh' ? 'Fresh Graduate' : 'Berpengalaman'}</span>
                    <h2>{result.readyLabel}</h2>
                    <p>
                      CV berisi {result.wordCount} kata. Skor dihitung dari bukti isi yang
                      benar-benar ada — bagian yang kosong poinnya 0. Skor tertinggi yang
                      realistis adalah 95: selalu ada lowongan yang menuntut bukti lain.
                    </p>
                    {result.matchScore !== null && (
                      <p>
                        <strong>Skor Cocok {result.matchScore}/100 ({result.matchLabel})</strong> —{' '}
                        {result.matchScore >= result.readyScore
                          ? 'CV-mu cocok dengan lowongan ini.'
                          : 'CV-mu kurang cocok dengan lowongan ini dibanding kesiapan umumnya.'}
                      </p>
                    )}
                    <button className="btn btn-secondary" type="button" onClick={handleCopyReport}>
                      <Icon d={I.copy} size={16} /> {copied ? 'Laporan tersalin!' : 'Salin Laporan'}
                    </button>
                  </div>
                </div>

                <div className="bars">
                  {result.aspects.map((a) => (
                    <div className="bar-row" key={a.name}>
                      <span className="bar-label">{a.name}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.round((a.score / a.max) * 100)}%` }}
                        />
                      </div>
                      <span className="bar-score">{a.score}/{a.max}</span>
                    </div>
                  ))}
                </div>

                {result.modeNote && (
                  <div className="alert alert-warn"><Icon d={I.alert} size={16} /> {result.modeNote}</div>
                )}

                {result.roleWarning && (
                  <div className="alert alert-warn"><Icon d={I.alert} size={16} /> {result.roleWarning}</div>
                )}

                {result.consistencyWarnings.length > 0 && (
                  <div className="alert alert-warn">
                    <Icon d={I.alert} size={16} />{' '}
                    {result.consistencyWarnings.map((w, i) => (
                      <span key={i} style={{ display: 'block', marginTop: i === 0 ? 0 : 6 }}>{w}</span>
                    ))}
                  </div>
                )}
              </div>

              {result.topEvidence.length > 0 && (
                <div className="card">
                  <h3><Icon d={I.check} size={18} /> Bukti Terbaik (STAR)</h3>
                  <ul className="check-list">
                    {result.topEvidence.map((e, i) => (
                      <li className="check-row status-baik" key={`${e.title}-${i}`}>
                        <span className="check-icon"><Icon d={I.check} size={15} /></span>
                        <div className="check-body">
                          <div className="check-head">
                            <strong>{e.title}</strong>
                            <span className="check-meta">STAR {e.score}/10</span>
                          </div>
                          <p>
                            Peran {e.roleScore}/2,5 • Periode {e.periodScore}/2,5 • Aksi {e.actionScore}/2,5 • Hasil {e.resultScore}/2,5
                            {e.reasons.length > 0 ? ` — kurang: ${e.reasons.join('; ')}.` : '.'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {result.extraEvidence.length > 0 && (
                    <p>
                      Kamu punya {result.extraEvidence.length} bukti kuat lain di luar 3 terbaik:{' '}
                      {result.extraEvidence.map((e) => e.title).join('; ')}.
                    </p>
                  )}
                </div>
              )}

              {result.strengths.length > 0 && (
                <div className="card">
                  <h3><Icon d={I.check} size={18} /> Kekuatan</h3>
                  <ul className="check-list">
                    {result.strengths.map((c) => <CheckRow key={c.id} check={c} />)}
                  </ul>
                </div>
              )}

              <div className="card">
                <h3><Icon d={I.alert} size={18} /> Prioritas Perbaikan</h3>
                {result.priorities.length === 0 ? (
                  <p>Semua pemeriksaan lolos dengan poin penuh. CV-mu sudah kuat — tinggal sesuaikan kata kunci untuk tiap lowongan.</p>
                ) : (
                  <ul className="check-list">
                    {result.priorities.map((c) => <CheckRow key={c.id} check={c} />)}
                  </ul>
                )}
              </div>

              {result.keywords && (
                <div className="card">
                  <h3><Icon d={I.target} size={18} /> Kecocokan Kata Kunci Lowongan</h3>
                  <p>
                    <strong>{result.keywords.percent}%</strong> dari {result.keywords.total} kata kunci
                    teratas lowongan ditemukan <strong>di dalam bukti</strong>. Bagian ini menjelaskan
                    Skor Cocok, bukan skor terpisah yang membingungkan.
                  </p>
                  <div className="chips-group">
                    <span className="chips-title">Ditemukan di bukti:</span>
                    <div className="chips">
                      {result.keywords.inEvidence.length
                        ? result.keywords.inEvidence.map((k) => <span key={k} className="chip chip-ok">{k}</span>)
                        : <span className="chip">—</span>}
                    </div>
                  </div>
                  <div className="chips-group">
                    <span className="chips-title">Hanya klaim (di CV, bukan di bukti):</span>
                    <div className="chips">
                      {result.keywords.inCvOnly.length
                        ? result.keywords.inCvOnly.map((k) => <span key={k} className="chip">{k}</span>)
                        : <span className="chip">—</span>}
                    </div>
                  </div>
                  <div className="chips-group">
                    <span className="chips-title">Belum ada:</span>
                    <div className="chips">
                      {result.keywords.missing.length
                        ? result.keywords.missing.map((k) => <span key={k} className="chip chip-miss">{k}</span>)
                        : <span className="chip">—</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* ----- ANALISIS AI ----- */}
              <div className="card ai-card">
                <h3><Icon d={I.spark} size={18} /> Analisis AI (OpenRouter)</h3>
                <p>
                  Mau saran yang lebih dalam dari skor di atas? AI lewat OpenRouter bisa membaca
                  CV-mu secara kualitatif: menulis ulang poin pengalamanmu, menunjukkan
                  kekurangan terhadap lowongan, dan memberi contoh ringkasan profil.
                  Bagian ini terpisah dan <strong>tidak mengubah skor utama</strong>. Model yang
                  dipakai adalah <strong>NVIDIA Nemotron 3 Ultra 550B (gratis)</strong> — hanya
                  untuk testing, bisa lambat atau kena rate limit.
                </p>

                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                  />
                  <span>
                    Saya setuju teks CV dikirim ke OpenRouter (model NVIDIA Nemotron 3 Ultra 550B, gratis) untuk dianalisis.
                    Hasil analisis berbahasa Indonesia, walau CV berbahasa Inggris (saran tulis ulang tetap dalam bahasa CV). Teks tidak disimpan oleh Screening CV.
                  </span>
                </label>

                <div className="ai-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleAiAnalyze}
                    disabled={!aiConsent || aiLoading || cvText.trim().length < 50}
                  >
                    <Icon d={I.spark} size={16} />
                    {aiLoading ? 'Menganalisis dengan AI…' : aiResult ? 'Analisis Ulang dengan AI' : 'Analisis dengan AI'}
                  </button>
                  {cvText.trim().length < 50 && (
                    <span className="ai-hint">Teks CV minimal 50 karakter untuk analisis AI.</span>
                  )}
                </div>

                {(aiLoading || aiThinking) && (
                  <div className="thinking-panel">
                    {aiLoading ? (
                      <>
                        <div className="thinking-head">
                          <span>Proses berpikir AI</span>
                          <span className="thinking-time">{aiElapsed} detik</span>
                        </div>
                        <div className="thinking-body" ref={thinkingBodyRef}>
                          {aiThinking || 'Menghubungi model AI…'}
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="thinking-summary"
                          onClick={() => setAiThinkingOpen((o) => !o)}
                        >
                          {aiError
                            ? `Proses berpikir terhenti (±${aiDuration ?? aiElapsed} detik) — klik untuk ${aiThinkingOpen ? 'menutup' : 'melihat'}`
                            : `Proses berpikir selesai (±${aiDuration ?? aiElapsed} detik) — klik untuk ${aiThinkingOpen ? 'menutup' : 'melihat'}`}
                        </button>
                        {aiThinkingOpen && (
                          <div className="thinking-body thinking-body-bordered" ref={thinkingBodyRef}>
                            {aiThinking}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {aiError && <div className="alert alert-error"><Icon d={I.alert} size={16} /> {aiError}</div>}

                {aiResult && (
                  <div className="ai-result">
                    {aiResult.ringkasan && (
                      <div className="ai-block">
                        <h4>Ringkasan Penilaian AI</h4>
                        <p>{aiResult.ringkasan}</p>
                      </div>
                    )}

                    {aiResult.saranPenulisanUlang.length > 0 && (
                      <div className="ai-block">
                        <h4>Saran Penulisan Ulang</h4>
                        <ul className="rewrite-list">
                          {aiResult.saranPenulisanUlang.map((r, i) => (
                            <li className="rewrite-item" key={i}>
                              <span className="rewrite-label">Asli</span>
                              <p className="rewrite-asli">{r.asli}</p>
                              <span className="rewrite-label">Saran</span>
                              <p className="rewrite-saran">{r.saran}</p>
                              {r.alasan && <p className="rewrite-alasan">{r.alasan}</p>}
                            </li>
                          ))}
                        </ul>
                        <p className="ai-note">
                          Saran di atas adalah contoh — sesuaikan angka dan fakta dengan
                          pengalaman aslimu. Jangan memakai angka yang tidak benar.
                        </p>
                      </div>
                    )}

                    {aiResult.kekurangan.length > 0 && (
                      <div className="ai-block">
                        <h4>Kekurangan Menurut AI</h4>
                        <ul className="ai-list">
                          {aiResult.kekurangan.map((k, i) => <li key={i}>{k}</li>)}
                        </ul>
                      </div>
                    )}

                    {aiResult.saranRingkasan && (
                      <div className="ai-block">
                        <h4>Contoh Ringkasan Profil</h4>
                        <p className="ai-summary">{aiResult.saranRingkasan}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ----- TRANSPARANSI ----- */}
          <div className="card">
            <h3><Icon d={I.book} size={18} /> Bagaimana skor dihitung?</h3>
            <p>
              Penilaian berbasis bukti (rule-based) dengan total <strong>100 poin</strong> dari{' '}
              <strong>6 aspek</strong>, ditampilkan dengan plafon realistis <strong>95</strong>.
              Poin hanya diberikan untuk bukti isi yang benar-benar ada di CV:
            </p>
            <ul className="rules-list">
              <li><strong>Kontak — 15 poin:</strong> email valid (6), nomor HP Indonesia (5), LinkedIn (2), link karya (2). Format HP 08xx, +62, maupun bertanda kurung dengan spasi/strip/titik tetap terbaca.</li>
              <li><strong>Ringkasan — 10 poin:</strong> panjang cukup 20–60 kata (4), menyebut peran target (3), merujuk bukti terkuat (3).</li>
              <li><strong>Bukti STAR — 30 poin:</strong> setiap bukti (kerja, magang, proyek, organisasi, tugas akhir, freelance) dinilai Peran, Periode, Aksi, Hasil — masing-masing 2,5 poin. Hanya 3 bukti terbaik yang dihitung (dirata-rata, lalu dikali 3). Kata kerja dan angka hanya dihitung bila berada di dalam bukti.</li>
              <li><strong>Pendidikan &amp; Belajar — 15 poin:</strong> pendidikan tercantum (8), IPK atau sertifikat/pelatihan (gabungan maksimal 7 — sertifikat bisa menggantikan IPK).</li>
              <li><strong>Skill Relevan — 15 poin:</strong> skill yang terbukti muncul di dalam bukti (9) dan relevansi dengan lowongan (6). Skill yang hanya diklaim di daftar bernilai 0.</li>
              <li><strong>Format &amp; ATS — 15 poin:</strong> panjang ideal 220–900 kata (6), struktur terbaca (5), bullet pada bukti (4).</li>
            </ul>
            <p>
              Label skor: 85–95 Sangat Siap Dilamar • 70–84 Sudah Bagus • 50–69 Perlu Perbaikan •
              di bawah 50 Perlu Dirombak Dulu. Skor Cocok dihitung bila ada lowongan: 70% Skor Siap
              + 30% kata kunci lowongan yang ditemukan di dalam bukti.
            </p>
          </div>

          {/* ----- TIPS ATS ----- */}
          <div className="card">
            <h3><Icon d={I.list} size={18} /> Tips lolos ATS</h3>
            <ol className="tips-list">
              {ATS_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
            </ol>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Penilaian standar berbasis bukti (rule-based) dan berjalan sepenuhnya di
          browser kamu — bukan keputusan rekruter, dan tidak ada data yang diunggah
          atau disimpan. Skor tertinggi yang realistis adalah 95. Satu-satunya pengecualian:
          fitur Analisis AI (opsional, hanya untuk testing) mengirim teks CV ke OpenRouter
          hanya bila kamu mencentang persetujuan, dan teks itu tidak disimpan oleh Screening CV.
        </p>
      </footer>
    </div>
  )
}
