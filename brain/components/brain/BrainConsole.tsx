'use client'

import { useCallback, useState } from 'react'
import BriefPanel from '@/components/brain/BriefPanel'
import ContractPanel from '@/components/brain/ContractPanel'
import ClaimCard from '@/components/brain/ClaimCard'
import CoachPanel from '@/components/brain/CoachPanel'
import MeetingPanel from '@/components/brain/MeetingPanel'
import LedgerPanel from '@/components/brain/LedgerPanel'
import PostCallPanel from '@/components/brain/PostCallPanel'
import type { BriefOpenPoint } from '@/lib/brain/agents/brief'
import type { ConnectorStatus } from '@/lib/brain/connectors/types'
import type { MemoryStats } from '@/lib/brain/memory'
import { agentHeadline, agentTab, type AgentKey } from '@/lib/brain/names'
import type { SyncReport } from '@/lib/brain/connectors'
import { CHANNEL_LABEL, type StoredDocument, type VerifiedClaim } from '@/lib/brain/types'

type Answer = {
  claims: VerifiedClaim[]
  openQuestions: string[]
  model: string
  hits: number
  empty: boolean
  /** Cosa è stato cercato davvero, espansione compresa. */
  searched?: string[]
  scanned?: number
  searchNote?: string
}

type Tab = 'brief' | 'meeting' | 'ask' | 'contracts' | 'ledger' | 'coach' | 'postcall' | 'sources' | 'memory'

/** Le schede che sono un assistente, e con che nome si presenta. */
const AGENT_OF: Partial<Record<Tab, AgentKey>> = {
  brief: 'brief',
  meeting: 'meeting',
  ask: 'chief',
  contracts: 'contracts',
  ledger: 'ledger',
  coach: 'coach',
  postcall: 'postcall',
}

/** L'ultima esecuzione automatica, già ridotta a quello che si mostra. */
type AutoSync = { at: string; stored: number; detail: string }

type Props = {
  ownerEmail: string
  initialConnectors: ConnectorStatus[]
  initialStats: MemoryStats
  initialDocuments: StoredDocument[]
  initialBrief: Record<string, unknown> | null
  initialPoints: BriefOpenPoint[]
  autoSync: AutoSync | null
  googleOutcome: { ok: boolean; detail: string } | null
}

const SUGGESTIONS = [
  'Cosa ho in agenda questa settimana?',
  'Qual è l\'ultima cosa che mi è stata chiesta e non ho ancora chiuso?',
  'Quali pagamenti sono usciti dal conto senza giustificativo?',
  'Come ho dormito negli ultimi giorni?',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BrainConsole({
  ownerEmail,
  initialConnectors,
  initialStats,
  initialDocuments,
  initialBrief,
  initialPoints,
  autoSync,
  googleOutcome,
}: Props) {
  const [tab, setTab] = useState<Tab>('brief')

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [error, setError] = useState<string | null>(
    googleOutcome && !googleOutcome.ok ? `Collegamento a Google non riuscito: ${googleOutcome.detail}` : null
  )

  const [connectors, setConnectors] = useState(initialConnectors)
  const [stats, setStats] = useState(initialStats)
  const [syncing, setSyncing] = useState(false)
  const [reports, setReports] = useState<SyncReport[] | null>(null)

  const [documents, setDocuments] = useState(initialDocuments)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const refreshDocuments = useCallback(async () => {
    const res = await fetch('/api/brain/documents?limit=40')
    if (!res.ok) return
    const data = await res.json()
    setDocuments(data.documents ?? [])
  }, [])

  /**
   * Cambiare scheda è un evento, non una sincronizzazione: ricaricare qui
   * invece che in un effetto evita il giro di render in più, e soprattutto
   * dice la cosa giusta — si ricarica perché l'utente ha chiesto di guardare.
   */
  const openTab = useCallback(
    (key: Tab) => {
      setTab(key)
      if (key === 'memory') void refreshDocuments()
    },
    [refreshDocuments]
  )

  async function ask(text: string) {
    const q = text.trim()
    if (!q || asking) return
    setAsking(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a rispondere.')
      else setAnswer(data as Answer)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setAsking(false)
    }
  }

  async function sync(sources?: string[]) {
    if (syncing) return
    setSyncing(true)
    setError(null)
    setReports(null)
    try {
      const res = await fetch('/api/brain/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sources ? { sources } : {}),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Sincronizzazione fallita.')
      else {
        setReports(data.reports ?? [])
        setStats(data.stats ?? stats)
        const statusRes = await fetch('/api/brain/sync')
        if (statusRes.ok) setConnectors((await statusRes.json()).connectors ?? connectors)
      }
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setSyncing(false)
    }
  }

  async function saveNote() {
    if (!noteBody.trim() || saving) return
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const res = await fetch('/api/brain/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noteTitle, body: noteBody }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a salvare.')
      else {
        setSaved(data.stored ? 'Salvata in memoria.' : 'Era già in memoria, identica.')
        setNoteTitle('')
        setNoteBody('')
        await refreshDocuments()
      }
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setSaving(false)
    }
  }

  async function forget(id: string) {
    const res = await fetch(`/api/brain/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) setDocuments((docs) => docs.filter((d) => d.id !== id))
  }

  const googleConnected = connectors.some((c) => c.key === 'gmail' && c.connected)

  return (
    <div className="brain">
      <div className="brain-shell">
        <header className="brain-head">
          <span className="brain-mark">BRAIN<span>.</span></span>
          <span className="brain-role">{agentHeadline('chief')} · {ownerEmail}</span>
          <span className="brain-count">
            {stats.total.toLocaleString('it-IT')} document{stats.total === 1 ? 'o' : 'i'} in memoria
          </span>
        </header>

        <nav className="brain-tabs" role="tablist">
          {(
            [
              ['brief', agentTab('brief')],
              ['meeting', agentTab('meeting')],
              ['ask', agentTab('chief')],
              ['contracts', agentTab('contracts')],
              ['ledger', agentTab('ledger')],
              ['coach', agentTab('coach')],
              ['postcall', agentTab('postcall')],
              ['sources', 'Fonti'],
              ['memory', 'Memoria'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="brain-tab"
              onClick={() => openTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {AGENT_OF[tab] ? <p className="brain-agent">{agentHeadline(AGENT_OF[tab]!)}</p> : null}

        {error ? <p className="brain-error">{error}</p> : null}
        {googleOutcome?.ok ? (
          <p className="brain-note">Google collegato{googleOutcome.detail ? ` come ${googleOutcome.detail}` : ''}.</p>
        ) : null}

        {/* --- BRIEF --- */}
        {tab === 'brief' ? (
          <BriefPanel initialBrief={initialBrief} initialPoints={initialPoints} />
        ) : null}

        {/* --- INCONTRI --- */}
        {tab === 'meeting' ? <MeetingPanel /> : null}

        {/* --- CHIEDI --- */}
        {tab === 'ask' ? (
          <section>
            <form
              className="brain-ask"
              onSubmit={(e) => {
                e.preventDefault()
                void ask(question)
              }}
            >
              <textarea
                className="brain-field"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Chiedi alla tua memoria. Risponde solo con quello che ci trova dentro."
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    void ask(question)
                  }
                }}
              />
              <div className="brain-actions">
                <button type="submit" className="brain-btn brain-btn-primary" disabled={asking || !question.trim()}>
                  {asking ? 'Sto leggendo…' : 'Chiedi'}
                </button>
                <span className="brain-meta">⌘/Ctrl + Invio</span>
              </div>
            </form>

            <div className="brain-suggestions" style={{ marginTop: '0.75rem' }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="brain-chip"
                  onClick={() => {
                    setQuestion(s)
                    void ask(s)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {answer ? (
              <div className="brain-answer">
                {answer.claims.map((claim, i) => (
                  <ClaimCard key={i} claim={claim} />
                ))}

                {!answer.claims.length ? (
                  <div className="brain-empty" style={{ textAlign: 'left' }}>
                    <p style={{ margin: '0 0 0.5rem' }}>
                      {answer.empty
                        ? 'In memoria non c\'è niente che corrisponda a questa domanda.'
                        : 'Le fonti trovate non rispondono alla domanda. Meglio dirlo che inventare.'}
                    </p>
                    {/* "Non risulta" da solo non è verificabile: dire cosa è stato
                        cercato, e su quanto, lo rende una frase che si può smentire. */}
                    {answer.searchNote ? <p style={{ margin: 0 }}>{answer.searchNote}</p> : null}
                  </div>
                ) : null}

                {answer.openQuestions.length ? (
                  <div className="brain-open">
                    <h3>Punti aperti</h3>
                    <ul>
                      {answer.openQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="brain-meta">
                  {answer.hits} pezzi letti · modello {answer.model}
                  {answer.searched && answer.searched.length > (answer.searchNote ? 0 : 99)
                    ? ` · cercato: ${answer.searched.join(', ')}`
                    : ''}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* --- CONTRATTI --- */}
        {tab === 'contracts' ? <ContractPanel documents={documents} /> : null}

        {/* --- CONTO --- */}
        {tab === 'ledger' ? <LedgerPanel /> : null}

        {/* --- COACH --- */}
        {tab === 'coach' ? <CoachPanel /> : null}

        {/* --- DOPO LA CALL --- */}
        {tab === 'postcall' ? <PostCallPanel /> : null}

        {/* --- FONTI --- */}
        {tab === 'sources' ? (
          <section>
            <div className="brain-auto">
              {autoSync ? (
                <>
                  <b>Sincronizzazione automatica</b> · ogni giorno alle 05:00 UTC.
                  {' '}Ultima: {formatDate(autoSync.at)} — {autoSync.detail}
                  {autoSync.stored ? `, ${autoSync.stored} nuovi documenti` : ', niente di nuovo'}.
                </>
              ) : (
                <>
                  <b>Sincronizzazione automatica</b> · pianificata ogni giorno alle 05:00 UTC,
                  ma non è ancora mai girata. Se hai appena fatto il deploy è normale; se sono
                  passati più di due giorni, controlla che <code>CRON_SECRET</code> sia impostata
                  su Vercel.
                </>
              )}
            </div>

            <div className="brain-actions" style={{ marginBottom: '1rem' }}>
              <button type="button" className="brain-btn brain-btn-primary" onClick={() => void sync()} disabled={syncing}>
                {syncing ? 'Sincronizzo…' : 'Sincronizza tutto'}
              </button>
              {!googleConnected ? (
                <a className="brain-btn" href="/api/brain/connect/google">Collega Google</a>
              ) : null}
            </div>

            <div className="brain-list">
              {connectors.map((c) => {
                const state = c.connected ? 'connected' : c.configured ? 'configured' : 'off'
                return (
                  <div key={c.key} className="brain-row">
                    <span className="brain-dot" data-state={state} />
                    <div className="brain-row-main">
                      <div className="brain-row-title">{c.label}</div>
                      <div className="brain-row-hint">{c.hint}</div>
                      <div className="brain-meta" style={{ marginTop: '0.375rem' }}>
                        {c.connected
                          ? `collegato${c.syncedAt ? ` · ultima sincronizzazione ${formatDate(c.syncedAt)}` : ' · mai sincronizzato'}`
                          : c.configured
                            ? 'configurato ma non collegato'
                            : 'chiavi assenti'}
                      </div>
                    </div>
                    <span className="brain-tag">
                      {stats.bySource.find((s) => s.source === c.key)?.count ?? 0}
                    </span>
                  </div>
                )
              })}
            </div>

            {reports ? (
              <div className="brain-section">
                <h2>Ultima sincronizzazione</h2>
                <div className="brain-list">
                  {reports.map((r) => (
                    <div key={r.source} className="brain-row">
                      <span className="brain-dot" data-state={r.error ? 'off' : 'connected'} />
                      <div className="brain-row-main">
                        <div className="brain-row-title">{r.label}</div>
                        <div className="brain-row-hint">
                          {r.error
                            ? `errore: ${r.error}`
                            : `${r.fetched} letti · ${r.stored} salvati · ${r.skipped} già identici`}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!reports.length ? <p className="brain-empty">Nessun connettore configurato.</p> : null}
                </div>
              </div>
            ) : null}

            <p className="brain-note brain-section">
              I connettori leggono e basta: nessuno di loro può scrivere una mail, spostare un
              evento o disporre un pagamento. Le credenziali stanno in <code>brain_credentials</code>,
              tabella con RLS attiva e nessuna policy — dal browser non è raggiungibile.
            </p>
          </section>
        ) : null}

        {/* --- MEMORIA --- */}
        {tab === 'memory' ? (
          <section>
            <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Aggiungi a mano</h2>
            <div className="brain-ask">
              <input
                className="brain-input"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Titolo (facoltativo)"
              />
              <textarea
                className="brain-field"
                rows={4}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Incolla un verbale, un passaggio di contratto, quello che ti hanno detto al telefono."
              />
              <div className="brain-actions">
                <button type="button" className="brain-btn brain-btn-primary" onClick={() => void saveNote()} disabled={saving || !noteBody.trim()}>
                  {saving ? 'Salvo…' : 'Salva in memoria'}
                </button>
                {saved ? <span className="brain-meta">{saved}</span> : null}
              </div>
            </div>

            <div className="brain-section">
              <h2>Ultimi documenti</h2>
              <div className="brain-list">
                {documents.map((d) => (
                  <div key={d.id} className="brain-row">
                    <span className="brain-dot" data-state="connected" />
                    <div className="brain-row-main">
                      <div className="brain-row-title">{d.title || '(senza titolo)'}</div>
                      <div className="brain-row-hint">{d.body.slice(0, 180)}</div>
                      <div className="brain-meta" style={{ marginTop: '0.375rem' }}>
                        {d.kind === 'correction' ? '✎ Correzione · ' : `${CHANNEL_LABEL[d.source]} · `}
                        {formatDate(d.occurredAt)}
                      </div>
                    </div>
                    <button type="button" className="brain-del" onClick={() => void forget(d.id)} title="Dimentica">
                      dimentica
                    </button>
                  </div>
                ))}
                {!documents.length ? (
                  <p className="brain-empty">La memoria è vuota. Collega una fonte o incolla una nota.</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
