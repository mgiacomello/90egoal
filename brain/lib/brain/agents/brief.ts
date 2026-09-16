import { verifyClaims } from '../cite'
import {
  listOpenPoints,
  logRun,
  openPoint,
  recentDocuments,
  touchPoint,
  type OpenPoint,
} from '../memory'
import { runStructured } from '../model'
import { decidePoints, staleness, type Staleness } from '../openpoints'
import type { MailBrief } from '../briefmail'
import { sourcesFromDocuments } from '../rank'
import { reviewLedger } from './ledger'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type StoredDocument, type VerifiedClaim } from '../types'

/**
 * Il brief.
 *
 * È il pezzo che cambia la natura del prodotto: fino a qui BRAIN
 * rispondeva solo se interrogato, e una memoria che aspetta di essere
 * cercata è una memoria che si usa due volte alla settimana. Il brief
 * gira dopo la sincronizzazione notturna e sta lì la mattina.
 *
 * Non inventa una forma nuova di garanzia: usa la stessa. Ogni riga
 * passa da `verifyClaims()`, quindi quello che il brief afferma è
 * riconducibile a un documento in memoria esattamente come una
 * risposta chiesta a mano. Il fatto che non l'abbia chiesto nessuno
 * non la rende meno verificabile — semmai di più, perché non c'è
 * nessuno lì a rileggerla nel momento in cui viene scritta.
 *
 * I soldi non passano dal modello: la parte sui giustificativi
 * mancanti arriva dall'agente Amministrazione, che è aritmetica.
 */

export const BRIEF_AGENT = 'brief'
const AGENT_KEY = BRIEF_AGENT

/** Quanto indietro guarda "cosa è arrivato". */
const NEWS_DAYS = 2
/** Quanti documenti mettere davanti al modello. */
const MAX_SOURCES = 22

const TOOL = {
  name: 'scrivi_brief',
  description: 'Compila il brief del giorno a partire dalle fonti fornite.',
  input_schema: {
    type: 'object' as const,
    properties: {
      oggi: {
        type: 'array',
        description:
          'Cosa c\'è oggi e domani: appuntamenti, scadenze, call. Solo da fonti di calendario o da date esplicite nei documenti. Vuoto se non c\'è niente.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Una frase, con l\'orario se c\'è.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
      novita: {
        type: 'array',
        description:
          'Cosa è arrivato che richiede qualcosa da te. Non un riassunto della posta: solo le cose su cui devi fare o decidere. Vuoto se non c\'è niente di rilevante.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Una frase che dice cosa è arrivato e cosa richiede.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
      puntiAperti: {
        type: 'array',
        description:
          'Impegni presi o domande ricevute non ancora chiuse, che emergono dalle fonti di oggi. Non ripetere quelli già elencati come GIÀ APERTI se non ci sono novità: quelli restano da soli.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'L\'impegno, formulato come lo scriveresti su una lista di cose da fare.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
    },
    required: ['oggi', 'novita', 'puntiAperti'],
  },
}

const SYSTEM = `Sei il capo di gabinetto di una sola persona e stai scrivendo il brief che leggerà appena sveglia. Ha trenta secondi.

Scrivi in italiano, per punti, frasi brevi. Niente saluti, niente "ecco il tuo brief", niente riassunti di cortesia.

REGOLE NON NEGOZIABILI
1. Ogni riga deve venire dalle FONTI qui sotto e dichiarare da quali, con il loro handle (F1, F2…). Una riga senza handle valido viene scartata automaticamente: scriverla è lavoro buttato.
2. Non usare conoscenze tue sul mondo o sulle persone. Se non c'è niente da dire in una sezione, lasciala vuota. Un brief corto e vero batte un brief lungo e gonfiato.
3. Niente riempitivi. "Hai ricevuto tre email" non è un'informazione. "Bianchi chiede conferma entro giovedì" lo è.
4. Numeri, importi, orari e date vanno copiati esattamente come compaiono nella fonte.
5. In "oggi" metti solo cose con una data che cade oggi o domani.
6. In "puntiAperti" metti solo impegni concreti, con un verbo e un soggetto: cose che si possono chiudere. Non stati d'animo, non "monitorare la situazione".
7. Se una fonte è un movimento del conto, non commentarla: la parte sui soldi la scrive un altro agente, e lo fa meglio.
8. Se fra le fonti c'è una CORREZIONE del titolare della memoria, vale su qualunque altra fonte sullo stesso punto, anche se più recente. Usa quella, e se un'altra fonte la contraddice dillo citandole entrambe.`

export type BriefOpenPoint = OpenPoint & {
  age: Staleness
  /** Il brief di oggi ne ha parlato di nuovo. */
  mentionedToday: boolean
}

export type Brief = {
  generatedAt: string
  oggi: VerifiedClaim[]
  novita: VerifiedClaim[]
  puntiAperti: BriefOpenPoint[]
  /** Dall'agente Amministrazione: deterministico, nessun modello. */
  conto: { missing: number; missingCents: number; resolvable: number } | null
  dropped: number
  model: string
  sources: SourceRef[]
}

function isUpcoming(doc: StoredDocument, now: Date): boolean {
  const at = Date.parse(doc.occurredAt)
  if (!Number.isFinite(at)) return false
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return at >= startOfToday && at <= startOfToday + 2 * 86_400_000
}

function formatSources(refs: SourceRef[]): string {
  return refs
    .map((ref) => {
      const d = new Date(ref.occurredAt)
      const when = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      return `[${ref.handle}] ${CHANNEL_LABEL[ref.source]} · ${when}\nTitolo: ${ref.title}\n${ref.excerpt}`
    })
    .join('\n\n---\n\n')
}

export async function writeBrief(now = new Date()): Promise<Brief> {
  const started = Date.now()

  const [documents, carried] = await Promise.all([recentDocuments(120), listOpenPoints()])

  const newsSince = now.getTime() - NEWS_DAYS * 86_400_000
  const relevant = documents.filter((doc) => {
    if (doc.source === 'qonto') return false // i soldi li guarda l'altro agente
    return isUpcoming(doc, now) || Date.parse(doc.occurredAt) >= newsSince
  })

  const offered = sourcesFromDocuments(relevant.slice(0, MAX_SOURCES))

  // La parte sui soldi non passa da nessun modello.
  let conto: Brief['conto'] = null
  try {
    const ledger = await reviewLedger(60)
    conto = { missing: ledger.missing, missingCents: ledger.missingCents, resolvable: ledger.resolvable }
  } catch {
    conto = null
  }

  if (!offered.length) {
    const brief: Brief = {
      generatedAt: now.toISOString(),
      oggi: [],
      novita: [],
      puntiAperti: carried.map((p) => ({ ...p, age: staleness(p.openedAt, now), mentionedToday: false })),
      conto,
      dropped: 0,
      model: 'nessuno',
      sources: [],
    }
    await logRun({
      agent: AGENT_KEY,
      question: '',
      answer: lighten(brief),
      model: null,
      hits: 0,
      latencyMs: Date.now() - started,
    })
    return brief
  }

  const today = `${String(now.getUTCDate()).padStart(2, '0')}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${now.getUTCFullYear()}`

  const { data, model } = await runStructured<{
    oggi?: RawClaim[]
    novita?: RawClaim[]
    puntiAperti?: RawClaim[]
  }>({
    task: 'answer',
    system: SYSTEM,
    user: [
      `Oggi è ${today}.`,
      '',
      carried.length
        ? `GIÀ APERTI (non ripeterli se non ci sono novità):\n${carried.map((p) => `- ${p.text}`).join('\n')}`
        : 'GIÀ APERTI: nessuno.',
      '',
      'FONTI',
      '',
      formatSources(offered),
    ].join('\n'),
    tool: TOOL,
  })

  const oggi = verifyClaims(Array.isArray(data.oggi) ? data.oggi : [], offered)
  const novita = verifyClaims(Array.isArray(data.novita) ? data.novita : [], offered)
  const nuovi = verifyClaims(Array.isArray(data.puntiAperti) ? data.puntiAperti : [], offered)

  // I punti: si aprono quelli nuovi, si aggiorna la data di quelli
  // riconosciuti. Non se ne chiude nessuno — mai, e non per dimenticanza.
  const mentioned = new Set<string>()
  for (const decision of decidePoints(nuovi.claims.map((c) => c.text), carried)) {
    if (decision.action === 'keep') {
      mentioned.add(decision.id)
      await touchPoint(decision.id)
      continue
    }
    const claim = nuovi.claims.find((c) => c.text === decision.text)
    await openPoint({
      text: decision.text,
      fingerprint: decision.fingerprint,
      citations: (claim?.sources ?? []).map((s) => ({
        source: s.source,
        title: s.title,
        occurredAt: s.occurredAt,
        url: s.url,
      })),
    })
  }

  const points = await listOpenPoints()

  const brief: Brief = {
    generatedAt: now.toISOString(),
    oggi: oggi.claims,
    novita: novita.claims,
    puntiAperti: points.map((p) => ({
      ...p,
      age: staleness(p.openedAt, now),
      mentionedToday: mentioned.has(p.id) || p.lastSeenAt >= now.toISOString().slice(0, 10),
    })),
    conto,
    dropped: oggi.dropped.length + novita.dropped.length + nuovi.dropped.length,
    model,
    sources: offered,
  }

  await logRun({
    agent: AGENT_KEY,
    question: '',
    answer: lighten(brief),
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })

  return brief
}

/**
 * Il brief come va conservato nel registro.
 *
 * Senza gli estratti delle fonti: servono al modello per scrivere, non
 * a chi legge. Tenerli raddoppierebbe la riga e ci metterebbe dentro
 * pezzi di email che non c'è motivo di duplicare.
 */
export function lighten(brief: Brief): Record<string, unknown> {
  const strip = (claims: VerifiedClaim[]) =>
    claims.map((c) => ({
      text: c.text,
      trust: c.trust,
      unverified: c.unverified,
      sources: c.sources.map(({ excerpt, ...rest }) => {
        void excerpt
        return rest
      }),
    }))

  return {
    generatedAt: brief.generatedAt,
    oggi: strip(brief.oggi),
    novita: strip(brief.novita),
    conto: brief.conto,
    dropped: brief.dropped,
    model: brief.model,
  }
}

/** Il brief nella forma minima che serve alla consegna. */
export function toMailBrief(brief: Brief): MailBrief {
  return {
    generatedAt: brief.generatedAt,
    oggi: brief.oggi.map(toMailClaim),
    novita: brief.novita.map(toMailClaim),
    puntiAperti: brief.puntiAperti.map((p) => ({ text: p.text, openedAt: p.openedAt, age: p.age })),
    conto: brief.conto,
  }
}

function toMailClaim(claim: VerifiedClaim) {
  return {
    text: claim.text,
    unverified: claim.unverified,
    sources: claim.sources.map((s) => ({
      source: s.source,
      title: s.title,
      occurredAt: s.occurredAt,
      url: s.url,
    })),
  }
}

/** Il brief senza scrivere niente: quello che la console mostra al caricamento. */
export async function readOpenPoints(now = new Date()): Promise<BriefOpenPoint[]> {
  const points = await listOpenPoints()
  return points.map((p) => ({ ...p, age: staleness(p.openedAt, now), mentionedToday: false }))
}
