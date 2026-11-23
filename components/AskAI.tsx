'use client'

import { useState, useRef } from 'react'
import { useLingua, useTx } from '@/components/Lingua'

const SUGGESTED = {
  it: [
    'Come si calcolano i punti?',
    'Chi è in testa alla classifica?',
    'Quali partite ci sono nella prossima schedina?',
    'Vale un gol al 90+2?',
  ],
  en: [
    'How are points calculated?',
    'Who is leading the standings?',
    'Which matches are on the next ticket?',
    'Does a goal at 90+2 count?',
  ],
}

export default function AskAI() {
  const tx = useTx()
  const lingua = useLingua()
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
        body: JSON.stringify({ question: text, lang: lingua }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || tx('Qualcosa è andato storto.', 'Something went wrong.'))
      else setAnswer(data.answer || '')
    } catch {
      setError(tx('Connessione non riuscita, riprova.', 'Connection failed, try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative">
      <div className="relative glass rounded-3xl p-7 sm:p-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--accent-cyan)]/12 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[var(--accent)]/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative">
          <span className="text-xs font-semibold tracking-widest text-[var(--accent-cyan)] uppercase">AI Mode 🏟️</span>
          <h2 className="font-display font-bold text-2xl sm:text-4xl mt-2">
            {tx('Le tue domande sul giorno della partita, con le risposte dell\'AI', 'Your matchday questions, answered by AI')}
          </h2>
          <p className="text-[var(--muted)] mt-3 max-w-2xl">
            {tx('Dubbi sulle regole, curiosità sulle partite in schedina, risultati o classifica di', 'Unsure about the rules, curious about the matches on the ticket, the results or the standings of')} <strong className="text-[var(--ink)]">90 &amp; Goal</strong>?
            {tx('Chiedi pure.', 'Just ask.')}
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
              placeholder={tx('Chiedi qualcosa sul gioco o sulle partite…', 'Ask something about the game or the matches…')}
              maxLength={300}
              className="flex-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent-cyan)]/50 transition-colors placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="btn-primary px-6 py-3 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? tx('Sto pensando…', 'Thinking…') : tx('Approfondisci con AI →', 'Ask the AI →')}
            </button>
          </form>

          {/* Suggerimenti */}
          {!answer && !loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED[lingua].map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuestion(s); ask(s) }}
                  className="text-xs text-[var(--ink)] bg-[var(--surface-2)] hover:bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--line)] rounded-full px-3 py-1.5 transition-colors"
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
              {tx('L\'AI sta cercando la risposta…', 'The AI is looking for the answer…')}
            </div>
          )}

          {answer && (
            <div className="mt-6 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-5 animate-fade-up">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--accent-cyan)] uppercase tracking-wider">
                ✨ {tx('Risposta AI', 'AI answer')}
              </div>
              <p className="text-[var(--ink)] leading-relaxed whitespace-pre-line text-[15px]">{answer}</p>
              <button
                onClick={() => { setAnswer(''); setQuestion(''); inputRef.current?.focus() }}
                className="mt-4 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                ← {tx('Fai un\'altra domanda', 'Ask another question')}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-5 text-sm text-[var(--danger)] bg-[var(--danger-soft)] border border-[var(--danger)] rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
