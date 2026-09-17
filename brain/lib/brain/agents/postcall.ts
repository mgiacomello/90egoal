import { verifyClaims } from '../cite'
import { documentById, listOpenPoints, logRun, recentDocuments, type OpenPoint } from '../memory'
import { runStructured } from '../model'
import {
  attendees,
  callKey,
  classifyMeetDoc,
  meetingDay,
  meetingTitle,
  parseTurns,
  renderFollowUp,
  segment,
  speakerShares,
  type FollowUp,
  type SpeakerShare,
} from '../transcript'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type StoredDocument, type VerifiedClaim } from '../types'

/**
 * L'agente Dopo la call.
 *
 * È il "Supporto Commerciale" del post: finita una call, qualcuno che
 * ti dice cosa è stato deciso, chi si è preso cosa, cosa è rimasto
 * senza risposta — e ti mette davanti la mail di follow-up già scritta.
 *
 * La fonte è Google Meet. Con la trascrizione o gli appunti di Gemini
 * attivi, Meet lascia in Drive un documento per ognuna delle due cose,
 * e Drive lo leggiamo già: questo agente non ha un connettore suo,
 * riconosce quei documenti dal titolo (`lib/brain/transcript.ts`) e li
 * ricongiunge alla stessa riunione.
 *
 * La trascrizione entra spezzata in tratti di qualche minuto, ognuno
 * con il suo handle: una riga del debrief cita il tratto, non l'ora, e
 * il verificatore controlla i numeri contro quel tratto. Gli appunti
 * di Gemini sono una fonte in più, con un limite dichiarato nel
 * prompt: sono un riassunto fatto da un altro modello, e dove
 * contraddicono la trascrizione vince la trascrizione.
 *
 * Gli impegni presi dal titolare diventano punti aperti — ma solo se lo
 * chiede lui con un tocco, e si chiudono solo a mano, come tutti gli
 * altri. La mail non parte: i connettori sono in sola lettura, e il
 * gesto di mandarla resta suo.
 */

const AGENT_KEY = 'postcall'
const MAX_SEGMENTS = 30
const MAX_NOTES_CHARS = 12_000

export type CallSummary = {
  key: string
  title: string
  day: string
  when: string
  transcriptId: string | null
  notesId: string | null
  url: string | null
}

export type Commitment = VerifiedClaim & {
  chi: string
  /** È un impegno del titolare. */
  mio: boolean
  entro: string | null
}

export type CallDebrief = {
  title: string
  day: string
  /** Chi ha parlato, e quanto. Calcolato, non stimato. */
  speakers: SpeakerShare[]
  attendees: string[]
  decisioni: VerifiedClaim[]
  impegni: Commitment[]
  domande: VerifiedClaim[]
  followUp: FollowUp | null
  /** I punti già aperti che il debrief ritrova. */
  openPoints: OpenPoint[]
  /** Quanta trascrizione è stata letta davvero, 0–1. */
  coverage: number
  hadNotes: boolean
  dropped: number
  model: string
  offered: SourceRef[]
}

const TOOL = {
  name: 'debriefing',
  description: 'Il debrief di una call: decisioni, impegni, domande rimaste aperte. Ogni riga con le fonti.',
  input_schema: {
    type: 'object' as const,
    properties: {
      decisioni: {
        type: 'array',
        description: 'Cosa è stato deciso, in una frase ciascuna. Solo decisioni esplicite, non intenzioni.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
      impegni: {
        type: 'array',
        description: 'Chi si è preso cosa, ed entro quando se è stato detto. Uno per riga.',
        items: {
          type: 'object',
          properties: {
            chi: { type: 'string', description: 'Il nome come compare nella trascrizione.' },
            mio: { type: 'boolean', description: 'true se chi si è preso l\'impegno è il TITOLARE.' },
            text: { type: 'string', description: 'Cosa deve fare, senza il nome davanti.' },
            entro: { type: 'string', description: 'La scadenza esattamente come detta, oppure stringa vuota.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['chi', 'mio', 'text', 'entro', 'sources'],
        },
      },
      domande: {
        type: 'array',
        description: 'Domande fatte e rimaste senza risposta, o punti rimandati. Vuoto se non ce ne sono.',
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
    required: ['decisioni', 'impegni', 'domande'],
  },
}

const SYSTEM = `Hai davanti la trascrizione di una call appena finita, spezzata in tratti. Devi fare il debrief per chi c'era: cosa è stato deciso, chi si è preso cosa, cosa è rimasto aperto.

Scrivi in italiano, frasi brevi, niente riassunto della conversazione. Niente "è stata una call produttiva".

REGOLE NON NEGOZIABILI
1. Ogni riga deve venire dalle FONTI e dichiarare da quali, con il loro handle (F1, F2…). Una riga senza handle valido viene scartata automaticamente. Cita il tratto in cui la cosa viene detta, non un tratto qualunque.
2. Una decisione è una cosa che qualcuno ha detto di fare o di non fare, e nessuno ha contraddetto. Un'idea buttata lì non è una decisione. Se non ci sono decisioni, la lista resta vuota.
3. Un impegno ha sempre un nome davanti. Se non si capisce chi se lo è preso, non è un impegno: va in "domande".
4. Numeri, importi, date, nomi vanno copiati esattamente come compaiono nel tratto citato. Un controllo automatico confronta ogni numero con le fonti citate.
5. Se fra le fonti ci sono gli APPUNTI DI GEMINI: sono un riassunto fatto da un altro modello. Usali per orientarti, ma ogni riga deve trovare conferma nella trascrizione; dove si contraddicono, vince la trascrizione.
6. Il TITOLARE è la persona indicata sotto: nella trascrizione compare col suo nome. Segna "mio: true" solo per gli impegni che ha preso lui.`

function formatSources(refs: SourceRef[]): string {
  return refs
    .map((ref) => {
      const d = new Date(ref.occurredAt)
      const when = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
      return `[${ref.handle}] ${CHANNEL_LABEL[ref.source]} · ${when}\nTitolo: ${ref.title}\n${ref.excerpt}`
    })
    .join('\n\n---\n\n')
}

/** I documenti di Meet in memoria, raggruppati per riunione. */
function groupCalls(docs: StoredDocument[]): CallSummary[] {
  const byKey = new Map<string, CallSummary>()
  for (const doc of docs) {
    const kind = classifyMeetDoc(doc.title)
    if (!kind) continue
    const key = callKey(doc.title, doc.occurredAt)
    const entry = byKey.get(key) ?? {
      key,
      title: meetingTitle(doc.title),
      day: meetingDay(doc.title, doc.occurredAt),
      when: doc.occurredAt,
      transcriptId: null,
      notesId: null,
      url: null,
    }
    if (kind === 'transcript') {
      entry.transcriptId = doc.id
      entry.url = doc.url ?? entry.url
    } else {
      entry.notesId = doc.id
      entry.url = entry.url ?? doc.url ?? null
    }
    byKey.set(key, entry)
  }
  return [...byKey.values()].sort((a, b) => b.day.localeCompare(a.day))
}

/** Le call recenti che hanno lasciato qualcosa in Drive. */
export async function listCalls(limit = 20): Promise<CallSummary[]> {
  const docs = await recentDocuments(200, 'gdrive')
  return groupCalls(docs).slice(0, limit)
}

/** Verifica una per una, così i campi in più (chi, mio, entro) restano attaccati. */
function verifyEach<T extends RawClaim>(items: T[], refs: SourceRef[]): { kept: (T & VerifiedClaim)[]; dropped: number } {
  const kept: (T & VerifiedClaim)[] = []
  let dropped = 0
  for (const item of items) {
    const { claims } = verifyClaims([{ text: item.text, sources: item.sources }], refs)
    if (claims.length) kept.push({ ...item, ...claims[0] })
    else dropped += 1
  }
  return { kept, dropped }
}

export type DebriefOptions = {
  /** L'id di uno qualunque dei documenti della call. */
  documentId: string
  /** Chi è il titolare, per riconoscerlo fra chi parla. */
  ownerEmail: string
  signal?: AbortSignal
}

export async function debrief(options: DebriefOptions): Promise<CallDebrief> {
  const started = Date.now()

  const anchor = await documentById(options.documentId)
  if (!anchor || !classifyMeetDoc(anchor.title)) {
    throw new Error('Questo documento non è una trascrizione né gli appunti di una call.')
  }

  // I fratelli: trascrizione e appunti della stessa riunione.
  const key = callKey(anchor.title, anchor.occurredAt)
  const siblings = (await recentDocuments(200, 'gdrive')).filter(
    (d) => classifyMeetDoc(d.title) && callKey(d.title, d.occurredAt) === key
  )
  const pool = siblings.some((d) => d.id === anchor.id) ? siblings : [anchor, ...siblings]

  const transcriptDoc = pool.find((d) => classifyMeetDoc(d.title) === 'transcript') ?? null
  const notesDoc = pool.find((d) => classifyMeetDoc(d.title) === 'notes') ?? null
  // Il corpo intero serve: la lista lo tronca.
  const transcript = transcriptDoc ? await documentById(transcriptDoc.id) : null
  const notes = notesDoc ? await documentById(notesDoc.id) : null

  const title = meetingTitle(anchor.title)
  const day = meetingDay(anchor.title, anchor.occurredAt)

  const turns = transcript ? parseTurns(transcript.body) : []
  const speakers = speakerShares(turns)
  const who = transcript ? attendees(transcript.body) : []

  const segments = transcript ? segment(turns) : []
  const offeredSegments = segments.slice(0, MAX_SEGMENTS)
  const coverage = segments.length ? offeredSegments.length / segments.length : 0

  const offered: SourceRef[] = []
  if (transcript) {
    offeredSegments.forEach((excerpt, i) => {
      offered.push({
        handle: '',
        documentId: transcript.id,
        source: 'gdrive',
        kind: 'file',
        title: `${title} · trascrizione, tratto ${i + 1} di ${segments.length}`,
        occurredAt: transcript.occurredAt,
        url: transcript.url ?? null,
        excerpt,
      })
    })
  }
  if (notes) {
    offered.push({
      handle: '',
      documentId: notes.id,
      source: 'gdrive',
      kind: 'file',
      title: `${title} · APPUNTI DI GEMINI`,
      occurredAt: notes.occurredAt,
      url: notes.url ?? null,
      excerpt: notes.body.slice(0, MAX_NOTES_CHARS),
    })
  }
  offered.forEach((ref, i) => (ref.handle = `F${i + 1}`))

  const allPoints = await listOpenPoints().catch(() => [] as OpenPoint[])
  const foldedTitle = title.toLowerCase()
  const openPoints = allPoints.filter(
    (p) =>
      p.citations.some((c) => c.title.toLowerCase().includes(foldedTitle)) ||
      who.some((name) => name && p.text.toLowerCase().includes(name.toLowerCase()))
  )

  const empty = (model: string): CallDebrief => ({
    title,
    day,
    speakers,
    attendees: who,
    decisioni: [],
    impegni: [],
    domande: [],
    followUp: null,
    openPoints,
    coverage,
    hadNotes: Boolean(notes),
    dropped: 0,
    model,
    offered,
  })

  if (!offered.length) {
    await logRun({ agent: AGENT_KEY, question: title, answer: { vuoto: true }, model: null, hits: 0, latencyMs: Date.now() - started })
    return empty('nessuno')
  }

  const { data, model } = await runStructured<{
    decisioni?: RawClaim[]
    impegni?: (RawClaim & { chi?: string; mio?: boolean; entro?: string })[]
    domande?: RawClaim[]
  }>({
    task: 'answer',
    system: SYSTEM,
    user: [
      `CALL: ${title}`,
      `GIORNO: ${day}`,
      `TITOLARE: ${options.ownerEmail}`,
      who.length ? `INVITATI: ${who.join(', ')}` : '',
      speakers.length ? `HA PARLATO: ${speakers.map((s) => `${s.speaker} ${Math.round(s.share * 100)}%`).join(', ')}` : '',
      coverage && coverage < 1 ? `ATTENZIONE: hai davanti solo il ${Math.round(coverage * 100)}% della trascrizione.` : '',
      '',
      'FONTI',
      '',
      formatSources(offered),
    ]
      .filter(Boolean)
      .join('\n'),
    tool: TOOL,
    signal: options.signal,
  })

  const decisioni = verifyClaims(Array.isArray(data.decisioni) ? data.decisioni : [], offered)
  const domande = verifyClaims(Array.isArray(data.domande) ? data.domande : [], offered)
  const rawImpegni = (Array.isArray(data.impegni) ? data.impegni : []).map((i) => ({
    text: String(i.text ?? '').trim(),
    sources: Array.isArray(i.sources) ? i.sources : [],
    chi: String(i.chi ?? '').trim(),
    mio: i.mio === true,
    entro: String(i.entro ?? '').trim() || null,
  }))
  const impegni = verifyEach(
    rawImpegni.filter((i) => i.text && i.chi),
    offered
  )

  const otherNames = speakers
    .map((s) => s.speaker)
    .filter((n) => !impegni.kept.some((i) => i.mio && i.chi === n))
    .filter((n) => !who.length || who.includes(n))

  const followUp = renderFollowUp({
    title,
    day,
    to: otherNames.length ? otherNames : who,
    decisioni: decisioni.claims.map((c) => c.text),
    impegni: impegni.kept.map((i) => `${i.chi}: ${i.text}${i.entro ? ` — entro ${i.entro}` : ''}`),
    domande: domande.claims.map((c) => c.text),
  })

  const report: CallDebrief = {
    ...empty(model),
    decisioni: decisioni.claims,
    impegni: impegni.kept,
    domande: domande.claims,
    followUp,
    dropped: decisioni.dropped.length + domande.dropped.length + impegni.dropped,
  }

  await logRun({
    agent: AGENT_KEY,
    question: title,
    answer: {
      decisioni: report.decisioni.length,
      impegni: report.impegni.length,
      domande: report.domande.length,
      dropped: report.dropped,
      coverage,
    },
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })

  return report
}
