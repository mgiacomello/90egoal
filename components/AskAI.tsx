'use client'

import { useState, useRef } from 'react'

const SUGGESTED = [
  'Come funziona il formato a 48 squadre del Mondiale 2026?',
  'Chi è in testa alla classifica di 90 & Goal?',
  'Quanti gol sono stati segnati nella Schedina 1?',
  'A che minuto si segna di più finora?',
]

export default function AskAI() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function ask(q: string) {
    const text = q.trim()
    if (!text || loading) return
    setLoading(true)
    setError('')
    setAnswer('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Qualcosa è andato storto.')
      else setAnswer(data.answer || '')
    } catch {
      setError('Connessione non riuscita, riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative">
      <div className="glass rounded-3xl p-7 sm:p-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--accent-cyan)]/12 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[var(--accent)]/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative">
          <span className="text-xs font-semibold tracking-widest text-[var(--accent-cyan)] uppercase">AI Mode 🏟️</span>
          <h2 className="font-display font-bold text-2xl sm:text-4xl mt-2">
            Le tue domande sul giorno della partita, con le risposte dell&apos;AI
          </h2>
          <p className="text-[var(--muted)] mt-3 max-w-2xl">
            Il più grande torneo sportivo è appena diventato ancora più grande. Curiosità sul Mondiale 2026,
            sui risultati o sulla classifica di <strong className="text-white">90 &amp; Goal</strong>?
            Chiedi pure.
          </p>

          {/* Input */}
          <form
            className="mt-6 flex flex-col sm:flex-row gap-2.5"
            onSubmit={(e) => { e.preventDefault(); ask(question) }}
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Chiedi qualcosa sul Mondiale…"
              maxLength={300}
              className="flex-1 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-[15px] outline-none focus:border-[var(--accent-cyan)]/50 transition-colors placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="btn-primary px-6 py-3 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sto pensando…' : 'Approfondisci con AI →'}
            </button>
          </form>

          {/* Suggerimenti */}
          {!answer && !loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuestion(s); ask(s) }}
                  className="text-xs text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 hover:border-white/15 rounded-full px-3 py-1.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Risposta */}
          {loading && (
            <div className="mt-6 flex items-center gap-2 text-[var(--muted)] text-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] animate-pulse-glow" />
              L&apos;AI sta cercando la risposta…
            </div>
          )}

          {answer && (
            <div className="mt-6 rounded-2xl bg-white/[0.03] border border-white/10 p-5 animate-fade-up">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--accent-cyan)] uppercase tracking-wider">
                ✨ Risposta AI
              </div>
              <p className="text-white/90 leading-relaxed whitespace-pre-line text-[15px]">{answer}</p>
              <button
                onClick={() => { setAnswer(''); setQuestion(''); inputRef.current?.focus() }}
                className="mt-4 text-xs text-[var(--muted)] hover:text-white transition-colors"
              >
                ← Fai un&apos;altra domanda
              </button>
            </div>
          )}

          {error && (
            <p className="mt-5 text-sm text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
