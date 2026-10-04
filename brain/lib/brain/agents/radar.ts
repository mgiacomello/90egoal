import { verifyClaims } from '../cite'
import { logRun, recentDocuments } from '../memory'
import { runStructured } from '../model'
import { DEFAULT_TOPICS, selectSignals } from '../radar'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type VerifiedClaim } from '../types'

/**
 * L'agente Radar.
 *
 * Notizie e prodotti nuovi che possono spostare il mercato in cui il
 * titolare lavora, con un'analisi e una prospettiva. La fonte sono i
 * feed letti ogni notte dal connettore Web: articoli con una data e un
 * link, citabili.
 *
 * La selezione la fa il codice — parole del profilo, doppioni tolti,
 * i più recenti davanti — e il modello legge solo quelli. Poi scrive
 * tre cose: i segnali (un fatto e il suo impatto), le prospettive
 * (cosa può succedere, dichiarato come interpretazione) e cosa
 * significa per il titolare. Ogni riga cita l'articolo da cui viene.
 * Un'interpretazione resta un'interpretazione, ed è scritta come tale.
 */

const AGENT_KEY = 'radar'

export type Signal = VerifiedClaim & { impatto: 'alto' | 'medio' | 'basso'; orizzonte: string }

export type RadarReport = {
  days: number
  examined: number
  offered: SourceRef[]
  topics: string[]
  segnali: Signal[]
  prospettive: VerifiedClaim[]
  perTe: VerifiedClaim[]
  dropped: number
  model: string
}

const TOOL = {
  name: 'radar',
  description: 'Segnali di mercato, prospettive e implicazioni per il titolare, ogni riga con le fonti.',
  input_schema: {
    type: 'object' as const,
    properties: {
      segnali: {
        type: 'array',
        description: 'I fatti che contano, dal più rilevante. Da tre a otto. Ognuno: cosa è successo e perché sposta qualcosa.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            impatto: { type: 'string', enum: ['alto', 'medio', 'basso'] },
            orizzonte: { type: 'string', description: 'Quando si sente: "subito", "6 mesi", "1-2 anni".' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'impatto', 'orizzonte', 'sources'],
        },
      },
      prospettive: {
        type: 'array',
        description: 'Cosa può succedere dopo, due o tre scenari. Ognuno comincia con "Interpretazione:" e cita gli articoli che lo motivano.',
        items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] },
      },
      perTe: {
        type: 'array',
        description: 'Cosa significa per il titolare — avvocato d\'impresa, legal tech, governance dell\'IA — in due o tre mosse concrete. Ognuna cita gli articoli.',
        items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] },
      },
    },
    required: ['segnali', 'prospettive', 'perTe'],
  },
}

const SYSTEM = `Sei un analista di mercato che scrive per una persona sola: un avvocato d'impresa che fa legal tech e governance dell'intelligenza artificiale, con clienti in Italia e in Europa. Hai davanti gli articoli degli ultimi giorni, già selezionati.

Scrivi in italiano, frasi brevi, niente premesse. Un fatto è un fatto; un'ipotesi comincia con "Interpretazione:".

REGOLE NON NEGOZIABILI
1. Ogni riga cita gli articoli da cui viene, con il loro handle (F1, F2…). Una riga senza handle valido viene scartata automaticamente.
2. Numeri, cifre, date e nomi vanno copiati esattamente dall'articolo citato. Un controllo automatico li confronta.
3. Non usare notizie che non stanno nelle fonti. Se un segnale importante manca, non inventarlo: scrivi solo quello che c'è.
4. "Impatto" è sul mercato del titolare — consulenza legale, legal tech, compliance IA — non sul mondo in generale. Un modello nuovo è un segnale solo se cambia qualcosa per lui.
5. Le prospettive sono scenari, non previsioni: dichiara l'incertezza, non spararla.
6. "Per te" sono mosse concrete: una cosa da leggere, un cliente da chiamare, un'offerta da aggiornare, una posizione da prendere.`

function topics(): string[] {
  const custom = process.env.BRAIN_RADAR_TOPICS?.split(',').map((s) => s.trim()).filter(Boolean)
  return custom?.length ? custom : DEFAULT_TOPICS
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

export async function scanRadar(days = 7, signal?: AbortSignal): Promise<RadarReport> {
  const started = Date.now()
  const since = Date.now() - days * 86_400_000
  const list = topics()

  const docs = (await recentDocuments(200, 'web')).filter((d) => Date.parse(d.occurredAt) >= since)
  const signals = selectSignals(
    docs.map((d) => ({ id: d.id, title: d.title, summary: d.body, occurredAt: d.occurredAt, doc: d })),
    list,
    20
  )

  const offered: SourceRef[] = signals.map((s, i) => ({
    handle: `F${i + 1}`,
    documentId: s.doc.id,
    source: 'web',
    kind: 'article',
    title: s.title,
    occurredAt: s.occurredAt,
    url: s.doc.url ?? null,
    excerpt: s.doc.body.slice(0, 1500),
  }))

  const empty: RadarReport = { days, examined: docs.length, offered, topics: list, segnali: [], prospettive: [], perTe: [], dropped: 0, model: 'nessuno' }
  if (!offered.length) {
    await logRun({ agent: AGENT_KEY, question: `${days} giorni`, answer: { examined: docs.length, vuoto: true }, model: null, hits: 0, latencyMs: Date.now() - started })
    return empty
  }

  const { data, model } = await runStructured<{
    segnali?: (RawClaim & { impatto?: string; orizzonte?: string })[]
    prospettive?: RawClaim[]
    perTe?: RawClaim[]
  }>({
    task: 'answer',
    system: SYSTEM,
    user: ['FONTI (articoli degli ultimi giorni, già selezionati)', '', formatSources(offered)].join('\n'),
    tool: TOOL,
    signal,
  })

  const segnali: Signal[] = []
  let droppedSignals = 0
  for (const raw of Array.isArray(data.segnali) ? data.segnali : []) {
    const { claims } = verifyClaims([{ text: String(raw.text ?? ''), sources: Array.isArray(raw.sources) ? raw.sources : [] }], offered)
    if (!claims.length) {
      droppedSignals += 1
      continue
    }
    const impatto = raw.impatto === 'alto' || raw.impatto === 'basso' ? raw.impatto : 'medio'
    segnali.push({ ...claims[0], impatto, orizzonte: String(raw.orizzonte ?? '').slice(0, 40) })
  }
  const prospettive = verifyClaims(Array.isArray(data.prospettive) ? data.prospettive : [], offered)
  const perTe = verifyClaims(Array.isArray(data.perTe) ? data.perTe : [], offered)

  const report: RadarReport = {
    ...empty,
    segnali,
    prospettive: prospettive.claims,
    perTe: perTe.claims,
    dropped: droppedSignals + prospettive.dropped.length + perTe.dropped.length,
    model,
  }
  await logRun({
    agent: AGENT_KEY,
    question: `${days} giorni`,
    answer: { examined: docs.length, offered: offered.length, segnali: segnali.length, dropped: report.dropped },
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })
  return report
}
