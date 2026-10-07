'use client'

import { useCallback, useState } from 'react'
import BoardPanel, { type StoredBoard } from '@/components/brain/BoardPanel'
import TodayPanel from '@/components/brain/TodayPanel'
import BriefPanel from '@/components/brain/BriefPanel'
import ContractPanel from '@/components/brain/ContractPanel'
import ClaimCard from '@/components/brain/ClaimCard'
import CoachPanel from '@/components/brain/CoachPanel'
import DeadlinesPanel from '@/components/brain/DeadlinesPanel'
import InboxPanel from '@/components/brain/InboxPanel'
import MeetingPanel from '@/components/brain/MeetingPanel'
import LedgerPanel from '@/components/brain/LedgerPanel'
import PostCallPanel from '@/components/brain/PostCallPanel'
import PracticePanel from '@/components/brain/PracticePanel'
import RadarPanel from '@/components/brain/RadarPanel'
import RecurringPanel from '@/components/brain/RecurringPanel'
import RelationsPanel from '@/components/brain/RelationsPanel'
import SlotsPanel from '@/components/brain/SlotsPanel'
import TrainingPanel from '@/components/brain/TrainingPanel'
import type { BriefOpenPoint } from '@/lib/brain/agents/brief'
import type { ConnectorStatus } from '@/lib/brain/connectors/types'
import type { MemoryStats } from '@/lib/brain/memory'
import { BOARD_ORDER, EXECUTIVES, type ExecutiveKey } from '@/lib/brain/executives'
import { PROFILE_TEMPLATE } from '@/lib/brain/profile'
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

type Tab =
  | 'today'
  | 'board'
  | 'brief' | 'meeting' | 'ask' | 'contracts' | 'ledger' | 'coach' | 'postcall'
  | 'deadlines' | 'inbox' | 'slots' | 'recurring' | 'relations' | 'training' | 'radar' | 'practice' | 'sources' | 'memory'

/** Le schede che sono un assistente, e con che nome si presenta. */
const AGENT_OF: Partial<Record<Tab, AgentKey>> = {
  brief: 'brief',
  meeting: 'meeting',
  ask: 'chief',
  contracts: 'contracts',
  ledger: 'ledger',
  coach: 'coach',
  postcall: 'postcall',
  deadlines: 'deadlines',
  inbox: 'inbox',
  slots: 'slots',
  recurring: 'recurring',
  relations: 'relations',
  training: 'training',
  radar: 'radar',
  practice: 'practice',
}

/** La scheda di ogni scrivania. */
const TAB_OF_DESK: Record<AgentKey, Tab> = {
  chief: 'ask', brief: 'brief', meeting: 'meeting', contracts: 'contracts', ledger: 'ledger', coach: 'coach',
  postcall: 'postcall', deadlines: 'deadlines', inbox: 'inbox', slots: 'slots', recurring: 'recurring',
  relations: 'relations', training: 'training', radar: 'radar', practice: 'practice',
}

/**
 * Le voci della barra laterale, per *cosa fai* — la giornata, lo
 * studio, i soldi, fuori, tu — e non per dirigente: una scrivania che
 * serve due dirigenti compare una volta sola, e accanto porta il nome
 * di chi la legge. Oggi per prima; il sistema in fondo.
 */
type NavItem = { key: Tab; label: string; who?: string }
type NavGroup = { label: string; items: NavItem[] }

function whoReads(desk: AgentKey): string {
  return BOARD_ORDER.filter((k) => EXECUTIVES[k].desks.includes(desk)).map((k) => EXECUTIVES[k].name).join(', ')
}

const desk = (d: AgentKey): NavItem => ({ key: TAB_OF_DESK[d], label: agentTab(d), who: whoReads(d) })

const GROUPS: NavGroup[] = [
  { label: 'Inizio', items: [{ key: 'today', label: 'Oggi' }, { key: 'ask', label: 'Chiedi', who: 'tutti' }, { key: 'board', label: 'Il tavolo', who: 'il board' }] },
  { label: 'La giornata', items: [desk('brief'), desk('inbox'), desk('deadlines'), desk('slots'), desk('meeting'), desk('postcall')] },
  { label: 'Lo studio', items: [desk('practice'), desk('contracts'), desk('relations')] },
  { label: 'I soldi', items: [desk('ledger'), desk('recurring')] },
  { label: 'Fuori e dentro', items: [desk('radar'), desk('coach'), desk('training')] },
  { label: 'Sistema', items: [{ key: 'sources', label: 'Fonti' }, { key: 'memory', label: 'Memoria' }] },
]

/** Il titolo grande di ogni pagina. */
const TITLE: Record<Tab, string> = {
  today: 'Oggi', board: 'Il tavolo', ask: 'Chiedi', sources: 'Le fonti', memory: 'La memoria',
  brief: 'Il brief', meeting: 'Incontri', contracts: 'Contratti', ledger: 'Il conto', coach: 'Coach', postcall: 'Dopo la call',
  deadlines: 'Scadenze', inbox: 'Posta in attesa', slots: 'Appuntamenti', recurring: 'Abbonamenti', relations: 'Relazioni',
  training: 'Allenamento', radar: 'Radar', practice: 'Lo studio',
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
  initialBoard: StoredBoard | null
  initialProfile: string | null
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
  initialBoard,
  initialProfile,
  autoSync,
  googleOutcome,
}: Props) {
  const [tab, setTab] = useState<Tab>('today')

  const [question, setQuestion] = useState('')
  const [askAs, setAskAs] = useState<ExecutiveKey>('grace')
  const [profile, setProfile] = useState(initialProfile ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState<string | null>(null)
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
        body: JSON.stringify({ question: q, executive: askAs }),
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

  async function saveProfileText() {
    if (profileSaving) return
    setProfileSaving(true)
    setProfileSaved(null)
    try {
      const res = await fetch('/api/brain/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: profile }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a salvare il profilo.')
      else setProfileSaved('Salvato: da adesso ogni dirigente lo legge prima di scrivere.')
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function sync(sources?: string[], days?: number) {
    if (syncing) return
    setSyncing(true)
    setError(null)
    setReports(null)
    try {
      const res = await fetch('/api/brain/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(sources ? { sources } : {}), ...(days ? { days } : {}) }),
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
          <span className="brain-role">{EXECUTIVES.grace.name} · {EXECUTIVES.grace.role} · {ownerEmail}</span>
          <span className="brain-count">
            {stats.total.toLocaleString('it-IT')} document{stats.total === 1 ? 'o' : 'i'} in memoria
          </span>
        </header>

        <div className="brain-layout">
        <nav className="brain-side" role="tablist" aria-label="Sezioni">
          {GROUPS.map((g) => (
            <div key={g.label} className="brain-side-group">
              <span className="brain-side-label">{g.label}</span>
              {g.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  className="brain-side-item"
                  onClick={() => openTab(item.key)}
                >
                  {item.label}
                  {item.who ? <small>{item.who}</small> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="brain-main">
        {tab !== 'today' ? (
          <div className="brain-panel-head">
            <h1 className="brain-h1">{TITLE[tab]}</h1>
            {tab === 'board' ? (
              <p className="brain-agent">{BOARD_ORDER.map((k) => `${EXECUTIVES[k].name} · ${EXECUTIVES[k].role}`).join('  ·  ')}</p>
            ) : AGENT_OF[tab] ? (
              <p className="brain-agent">{agentHeadline(AGENT_OF[tab]!)}{AGENT_OF[tab] !== 'chief' ? ` · legge ${whoReads(AGENT_OF[tab]!)}` : ''}</p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="brain-error">{error}</p> : null}
        {googleOutcome?.ok ? (
          <p className="brain-note">Google collegato{googleOutcome.detail ? ` come ${googleOutcome.detail}` : ''}.</p>
        ) : null}

        {/* --- OGGI --- */}
        {tab === 'today' ? (
          <TodayPanel
            ownerEmail={ownerEmail}
            connectors={connectors}
            brief={initialBrief}
            points={initialPoints}
            total={stats.total}
            autoSync={autoSync}
            go={openTab}
          />
        ) : null}

        {/* --- IL TAVOLO --- */}
        {tab === 'board' ? <BoardPanel initialBoard={initialBoard} /> : null}

        {/* --- BRIEF --- */}
        {tab === 'brief' ? (
          <BriefPanel initialBrief={initialBrief} initialPoints={initialPoints} />
        ) : null}

        {/* --- INCONTRI --- */}
        {tab === 'meeting' ? <MeetingPanel /> : null}

        {/* --- CHIEDI --- */}
        {tab === 'ask' ? (
          <section>
            <div className="brain-actions" style={{ marginBottom: '0.75rem' }}>
              {BOARD_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="brain-chip"
                  aria-pressed={askAs === k}
                  onClick={() => setAskAs(k)}
                  title={EXECUTIVES[k].title}
                >
                  {EXECUTIVES[k].name}
                </button>
              ))}
              <span className="brain-meta">risponde {EXECUTIVES[askAs].name} · {EXECUTIVES[askAs].title}</span>
            </div>
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

        {/* --- SCADENZE --- */}
        {tab === 'deadlines' ? <DeadlinesPanel /> : null}

        {/* --- POSTA --- */}
        {tab === 'inbox' ? <InboxPanel /> : null}

        {/* --- APPUNTAMENTI --- */}
        {tab === 'slots' ? <SlotsPanel /> : null}

        {/* --- ABBONAMENTI --- */}
        {tab === 'recurring' ? <RecurringPanel /> : null}

        {/* --- RELAZIONI --- */}
        {tab === 'relations' ? <RelationsPanel /> : null}

        {/* --- ALLENAMENTO --- */}
        {tab === 'training' ? <TrainingPanel /> : null}

        {/* --- RADAR --- */}
        {tab === 'radar' ? <RadarPanel /> : null}

        {/* --- STUDIO --- */}
        {tab === 'practice' ? <PracticePanel /> : null}

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
              {/* La prima volta la memoria guarda indietro di un mese. Le call
                  e i contratti di prima esistono lo stesso: questo li va a prendere. */}
              <button type="button" className="brain-btn" onClick={() => void sync(undefined, 90)} disabled={syncing}>
                Riprendi gli ultimi 90 giorni
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
            <h2 style={{ fontSize: '1rem', margin: '0 0 0.25rem' }}>Chi sei, per i tuoi dirigenti</h2>
            <p className="brain-note" style={{ marginBottom: '0.75rem' }}>
              Ogni dirigente legge questo testo prima di scrivere. È <b>contesto</b>, non una fonte: serve a
              scegliere cosa conta, non a inventare fatti — una riga che cita solo il profilo non passa.
            </p>
            <div className="brain-ask">
              <textarea
                className="brain-field"
                rows={8}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder={PROFILE_TEMPLATE}
              />
              <div className="brain-actions">
                <button type="button" className="brain-btn brain-btn-primary" onClick={() => void saveProfileText()} disabled={profileSaving || profile.trim().length < 20}>
                  {profileSaving ? 'Salvo…' : 'Salva il profilo'}
                </button>
                {profileSaved ? <span className="brain-meta">{profileSaved}</span> : null}
              </div>
            </div>

            <h2 style={{ fontSize: '1rem', margin: '1.5rem 0 0.75rem' }}>Aggiungi a mano</h2>
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
      </div>
    </div>
  )
}
