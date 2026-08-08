import { useEffect, useState } from 'react'
import { getHealth, queryAPI, clearCache } from './api'

function SourceList({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-slate-400 underline hover:text-slate-200"
      >
        {open ? 'Sembunyikan' : 'Lihat'} sumber ({sources.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <li
              key={i}
              className="rounded-md border border-slate-700 bg-slate-800/50 p-2 text-xs text-slate-300"
            >
              <div className="mb-1 font-mono text-slate-400">
                score {s.score.toFixed(4)} · source_id {s.source_id} · chunk #{s.chunk_idx}
              </div>
              <div className="line-clamp-3">{s.chunk}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HealthBadge({ health }) {
  if (!health) return <span className="text-xs text-slate-500">memuat status…</span>
  const ok = health.ollama_ok && health.engine_loaded
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {ok ? 'Ollama & engine OK' : 'Offline'}
      {health.chunks != null && <span className="text-slate-400">· {health.chunks} chunks</span>}
    </span>
  )
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [question, setQuestion] = useState('')
  const [k, setK] = useState(5)
  const [useCache, setUseCache] = useState(true)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ error: true }))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q || sending) return
    setQuestion('')
    setMessages((m) => [...m, { role: 'q', question: q }])
    setSending(true)
    try {
      const data = await queryAPI(q, k, useCache)
      setMessages((m) => [
        ...m,
        { role: 'a', answer: data.answer, fromCache: data.from_cache, sources: data.sources },
      ])
    } catch (err) {
      setMessages((m) => [...m, { role: 'a', error: err.message }])
    } finally {
      setSending(false)
    }
  }

  async function handleClearCache() {
    await clearCache()
    setHealth(await getHealth())
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">RAG Q&A</h1>
            <p className="text-xs text-slate-400">FAISS + phi3 via Ollama · FastAPI backend</p>
          </div>
          <div className="flex items-center gap-3">
            <HealthBadge health={health} />
            <button
              onClick={handleClearCache}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Hapus cache
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === 'q' ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-800 px-4 py-2 text-sm">
                    {m.question}
                  </div>
                </div>
              ) : m.error ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
                  Error: {m.error}
                </div>
              ) : (
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-900 px-4 py-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>Jawaban</span>
                    {m.fromCache && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
                        from cache
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.answer}</p>
                  <SourceList sources={m.sources} />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-500" />
              Menjawab…
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-xl"
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            rows={2}
            placeholder="Tanyakan sesuatu… (mis. What differs Partido Colorado and Partido Blanco?)"
            className="w-full resize-none rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-1">
                k
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="w-14 rounded-md bg-slate-800 px-2 py-1 outline-none"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={useCache}
                  onChange={(e) => setUseCache(e.target.checked)}
                  className="accent-slate-400"
                />
                use cache
              </label>
            </div>
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
            >
              Kirim
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
