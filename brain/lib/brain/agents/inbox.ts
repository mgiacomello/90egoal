import { verifyClaims } from '../cite'
import { recipientsOf, senderOf, waitingOnMe, type MailLike, type WaitingThread } from '../inbox'
import { documentById, logRun, recentDocuments } from '../memory'
import { runStructured } from '../model'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type StoredDocument, type VerifiedClaim } from '../types'

/**
 * L'agente Posta.
 *
 * Non riassume la casella. Dice una cosa sola, e la dice come fatto:
 * **in questi thread l'ultima parola non è tua, da N giorni.** Si
 * calcola dai messaggi — chi ha scritto per ultimo, quando — senza
 * modello, e si ordina per peso: prima chi ti ha scritto direttamente
 * con una domanda, poi il resto, dal più vecchio.
 *
 * Il modello entra solo quando lo chiedi, per una bozza di risposta.
 * E la bozza passa dal verificatore come tutto il resto: ogni
 * paragrafo cita i messaggi del thread da cui prende i fatti, e un
 * impegno che non sta in nessuna fonte ("ti mando tutto entro
 * venerdì") non può comparire — al suo posto c'è uno spazio da
 * riempire a mano. La mail non parte: la copi, la rileggi, la mandi tu.
 */

const AGENT_KEY = 'inbox'
const POOL = 200

export type InboxReport = {
  examined: number
  threads: number
  rows: WaitingThread[]
}

function toMail(doc: StoredDocument): MailLike {
  const meta = doc.metadata ?? {}
  return {
    id: doc.id,
    threadId: String(meta.threadId ?? doc.externalId),
    title: doc.title,
    occurredAt: doc.occurredAt,
    from: senderOf(doc.body) ?? '',
    to: recipientsOf(doc.body),
    labels: Array.isArray(meta.labels) ? meta.labels.map(String) : [],
    url: doc.url ?? null,
    body: doc.body,
  }
}

export async function reviewInbox(ownerEmail: string, minDays = 1): Promise<InboxReport> {
  const started = Date.now()
  const docs = await recentDocuments(POOL, 'gmail')
  const mails = docs.map(toMail).filter((m) => m.from)
  const rows = waitingOnMe(mails, ownerEmail, new Date(), minDays)
  const report: InboxReport = { examined: mails.length, threads: new Set(mails.map((m) => m.threadId)).size, rows }

  await logRun({
    agent: AGENT_KEY,
    question: `posta in attesa da almeno ${minDays} giorni`,
    answer: { examined: report.examined, waiting: rows.length },
    model: 'nessuno (deterministico)',
    hits: rows.length,
    latencyMs: Date.now() - started,
  })
  return report
}

/* ------------------------------------------------------------------ *
 * La bozza
 * ------------------------------------------------------------------ */

const TOOL = {
  name: 'bozza',
  description: 'Una bozza di risposta, paragrafo per paragrafo, ogni paragrafo con le fonti.',
  input_schema: {
    type: 'object' as const,
    properties: {
      paragrafi: {
        type: 'array',
        description: 'Da due a quattro paragrafi brevi. Il saluto iniziale e la firma NON vanno scritti.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
    },
    required: ['paragrafi'],
  },
}

const SYSTEM = `Stai scrivendo, per conto del titolare, la bozza di risposta a una mail. Tono: cordiale, diretto, professionale, italiano. Frasi brevi. Niente formule vuote.

REGOLE NON NEGOZIABILI
1. Ogni paragrafo deve appoggiarsi alle FONTI (i messaggi del thread e, se ci sono, altri documenti) e dichiarare da quali, con il loro handle (F1, F2…). Un paragrafo senza handle valido viene scartato.
2. Non prendere impegni che non stanno nelle fonti: niente date, cifre, promesse inventate. Dove serve una decisione del titolare scrivi uno spazio fra parentesi quadre, così: [entro quando].
3. Rispondi a quello che viene chiesto, nell'ordine in cui viene chiesto. Se una richiesta non trova risposta nelle fonti, dillo con uno spazio da riempire, non con una frase generica.
4. Niente saluto iniziale e niente firma: li mette il titolare.`

export type Draft = {
  subject: string
  to: string
  paragrafi: VerifiedClaim[]
  /** La mail completa, pronta da copiare. */
  text: string
  dropped: number
  model: string
}

function formatSources(refs: SourceRef[]): string {
  return refs
    .map((ref) => {
      const d = new Date(ref.occurredAt)
      const when = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
      return `[${ref.handle}] ${CHANNEL_LABEL[ref.source]} · ${when}\nTitolo: ${ref.title}\n${ref.excerpt}`
    })
    .join('\n\n---\n\n')
}

export async function draftReply(documentId: string, ownerEmail: string, signal?: AbortSignal): Promise<Draft> {
  const started = Date.now()
  const last = await documentById(documentId)
  if (!last || last.source !== 'gmail') throw new Error('Questo documento non è una mail.')

  const threadId = String(last.metadata?.threadId ?? last.externalId)
  const thread = (await recentDocuments(POOL, 'gmail'))
    .filter((d) => String(d.metadata?.threadId ?? d.externalId) === threadId)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
  const pool = thread.some((d) => d.id === last.id) ? thread : [...thread, last]

  const offered: SourceRef[] = pool.slice(-8).map((d, i) => ({
    handle: `F${i + 1}`,
    documentId: d.id,
    source: 'gmail',
    kind: 'email',
    title: d.title,
    occurredAt: d.occurredAt,
    url: d.url ?? null,
    excerpt: d.body.slice(0, 4000),
  }))

  const { data, model } = await runStructured<{ paragrafi?: RawClaim[] }>({
    task: 'draft',
    system: SYSTEM,
    user: [
      `TITOLARE: ${ownerEmail}`,
      `RISPONDI A: ${senderOf(last.body) ?? '—'}`,
      `OGGETTO: ${last.title}`,
      '',
      'FONTI (il thread, dal più vecchio)',
      '',
      formatSources(offered),
    ].join('\n'),
    tool: TOOL,
    signal,
  })

  const verified = verifyClaims(Array.isArray(data.paragrafi) ? data.paragrafi : [], offered)
  const subject = /^(re|r):/i.test(last.title) ? last.title : `Re: ${last.title}`
  const to = senderOf(last.body) ?? ''
  const text = ['Buongiorno,', '', ...verified.claims.flatMap((c) => [c.text, '']), 'Cordiali saluti,'].join('\n')

  const draft: Draft = { subject, to, paragrafi: verified.claims, text, dropped: verified.dropped.length, model }

  await logRun({
    agent: AGENT_KEY,
    question: `bozza: ${last.title}`,
    answer: { paragrafi: draft.paragrafi.length, dropped: draft.dropped },
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })
  return draft
}
