import { verifyClaims } from '../cite'
import {
  dayOf,
  explainWorst,
  isEvening,
  summarize,
  type CalendarDay,
  type Correlation,
  type HealthDay,
  type HealthSummary,
} from '../health'
import { logRun, recentDocuments, searchMemory } from '../memory'
import { runStructured } from '../model'
import { rankHits, selectSources, sourcesFromDocuments } from '../rank'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type StoredDocument, type VerifiedClaim } from '../types'

/**
 * L'agente Coach.
 *
 * È il "DiegoAI" del post che ha ispirato questo prodotto, ridotto a
 * quello che si può fare in modo onesto con un anello e un'agenda.
 *
 * La divisione del lavoro è la stessa dell'Amministrazione, e per la
 * stessa ragione: **i numeri li fa il codice, il modello dice cosa
 * farci.** Medie, tendenze, giorni peggiori e cosa c'era in agenda il
 * giorno prima arrivano già calcolati; il modello li commenta citando
 * le fonti, come tutto il resto. Un "stai dormendo meglio" detto quando
 * la curva scende è la frase che fa smettere di fidarsi di un coach, e
 * qui non può succedere perché la direzione della curva non la decide
 * lui.
 *
 * C'è un trucco di forma che vale la pena capire. Il verificatore
 * controlla che ogni numero in una frase compaia nelle fonti citate.
 * Ma una *media* di trenta giorni non sta in nessun documento: è
 * calcolata. Quindi il riepilogo calcolato viene offerto al modello
 * **come fonte**, con il canale `Calcolo`: una frase che dice "sonno
 * medio 74,3" e cita quel riepilogo passa; una che dice 78 no. Il
 * calcolo è citabile perché è verificabile — sta in `health.ts`, con i
 * suoi test.
 *
 * E la cosa da dire prima di tutte: **non è un parere medico.** Non lo
 * è il file, non lo è il prompt, e l'interfaccia lo scrive.
 */

const AGENT_KEY = 'coach'

const TOOL = {
  name: 'consiglia',
  description: 'Commenta i numeri e propone cosa fare, sempre citando le fonti.',
  input_schema: {
    type: 'object' as const,
    properties: {
      osservazioni: {
        type: 'array',
        description:
          'Cosa dicono i numeri, in due o tre frasi. Ognuna con le fonti. Solo cose che i dati sostengono davvero.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
      consigli: {
        type: 'array',
        description:
          'Cosa provare questa settimana: concreto, piccolo, verificabile la settimana dopo. Massimo tre. Ognuno collegato a un\'osservazione tramite le fonti.',
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
    required: ['osservazioni', 'consigli'],
  },
}

const SYSTEM = `Sei un coach del sonno e del recupero che parla con una persona adulta e impegnata. Hai davanti i suoi numeri degli ultimi giorni, già calcolati, e la sua agenda.

Scrivi in italiano, per punti, frasi brevi. Niente "ottimo lavoro", niente "ricorda che", niente moralismi.

REGOLE NON NEGOZIABILI
1. Ogni frase deve venire dalle FONTI qui sotto e dichiarare da quali, con il loro handle (F1, F2…). Una frase senza handle valido viene scartata automaticamente.
2. I numeri sono già calcolati nella fonte RIEPILOGO CALCOLATO: copiali da lì, esattamente. Non ricalcolare medie, non stimare tendenze, non arrotondare. Un controllo automatico confronta ogni numero con le fonti citate.
3. Se i giorni di prontezza bassa hanno qualcosa in comune nell'agenda del giorno prima, dillo: è la cosa più utile che puoi fare. Se non hanno niente in comune, dillo lo stesso, e non inventare un pattern.
4. I consigli sono piccoli e verificabili la settimana dopo: "spegnere lo schermo alle 22:30 le sere prima di una call alle 9", non "dormire di più".
5. NON sei un medico. Non diagnosticare, non nominare patologie, non interpretare esami del sangue oltre a quello che c'è scritto in chiaro nella fonte. Se i dati suggeriscono qualcosa che va guardato da un medico, dì esattamente questo: "vale la pena parlarne con il tuo medico", senza dire cosa.
6. Con meno di sette giorni di dati, dillo prima di ogni altra cosa e limitati a un'osservazione.`

export type CoachReport = {
  summary: HealthSummary
  correlations: Correlation[]
  osservazioni: VerifiedClaim[]
  consigli: VerifiedClaim[]
  dropped: number
  model: string
  /** Quanti documenti di salute (referti, note) la memoria aveva, oltre all'anello. */
  healthDocuments: number
}

/** Da un documento Oura al giorno di numeri. Vive nei metadati: niente da parsare. */
function toHealthDay(doc: StoredDocument): HealthDay | null {
  const meta = doc.metadata ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const day = doc.externalId.startsWith('day:') ? doc.externalId.slice(4) : dayOf(doc.occurredAt)
  const out = { day, sleep: num(meta.sleepScore), readiness: num(meta.readinessScore), activity: num(meta.activityScore) }
  return out.sleep === null && out.readiness === null && out.activity === null ? null : out
}

/** L'agenda raggruppata per giorno, con la bandierina "sera". */
function toCalendarDays(events: StoredDocument[]): CalendarDay[] {
  const byDay = new Map<string, CalendarDay>()
  for (const e of events) {
    const day = dayOf(e.occurredAt)
    const entry = byDay.get(day) ?? { day, events: [], lateEnd: false }
    entry.events.push(e.title)
    if (isEvening(e.occurredAt)) entry.lateEnd = true
    byDay.set(day, entry)
  }
  return [...byDay.values()]
}

function fmt(v: number | null): string {
  return v === null ? '—' : String(v).replace('.', ',')
}

/**
 * Il riepilogo come fonte citabile.
 *
 * Il verificatore chiede che ogni numero compaia nella fonte citata, e
 * una media non compare in nessun documento. Quindi il calcolo *è* un
 * documento: il modello lo cita, il verificatore lo trova, e chi legge
 * vede sotto la frase il chip "Calcolo". Che è la verità.
 */
function summarySource(summary: HealthSummary, correlations: Correlation[], handle: string): SourceRef {
  const lines: string[] = [
    `Finestra: dal ${summary.from ?? '—'} al ${summary.to ?? '—'}, ${summary.days} giorni con dati.`,
    '',
  ]
  for (const m of summary.metrics) {
    lines.push(
      `${m.label.toUpperCase()}: media ${fmt(m.average)}/100 su ${m.samples} giorni; ultimi sette ${fmt(m.recent)}, prima ${fmt(m.earlier)}; tendenza ${m.trend}.`
    )
    if (m.worst.length) {
      lines.push(`  giorni peggiori: ${m.worst.map((d) => `${d.day} (${fmt(d[m.metric])})`).join(', ')}`)
    }
  }
  if (correlations.length) {
    lines.push('', 'PRONTEZZA BASSA E AGENDA DEL GIORNO PRIMA:')
    for (const c of correlations) {
      lines.push(
        `  ${c.day} prontezza ${fmt(c.readiness)} — il giorno prima: ${
          c.before
            ? `${c.before.events.join('; ')}${c.before.lateEnd ? ' (con un impegno di sera)' : ''}`
            : 'niente in agenda'
        }`
      )
    }
  }

  return {
    handle,
    documentId: 'calc:health',
    source: 'calc',
    kind: 'note',
    title: 'Riepilogo calcolato dai dati dell\'anello',
    occurredAt: new Date().toISOString(),
    url: null,
    excerpt: lines.join('\n'),
  }
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

export async function coach(days = 30, signal?: AbortSignal): Promise<CoachReport> {
  const started = Date.now()
  const since = Date.now() - days * 86_400_000

  const [ouraDocs, calendarDocs] = await Promise.all([
    recentDocuments(200, 'oura'),
    recentDocuments(200, 'gcal'),
  ])

  const healthDays = ouraDocs
    .filter((d) => Date.parse(d.occurredAt) >= since)
    .map(toHealthDay)
    .filter((d): d is HealthDay => d !== null)

  const calendar = toCalendarDays(
    calendarDocs.filter((d) => {
      const t = Date.parse(d.occurredAt)
      return t >= since - 86_400_000 && t <= Date.now()
    })
  )

  // Tutto quello che conta sui numeri, deciso qui e non dal modello.
  const summary = summarize(healthDays)
  const correlations = explainWorst(healthDays, calendar, 3)

  // Referti e note di salute, se ce ne sono: il modello può citarli,
  // ma con la regola 5 addosso.
  const healthHits = await searchMemory(
    'esami or analisi or referto or visita or medico or sangue or allenamento or nutrizionista',
    { limit: 30, sources: ['gdrive', 'manual'] }
  ).catch(() => [])
  const healthDocs = selectSources(rankHits(healthHits, 'salute esami referto'), { maxDocuments: 3 })

  // Le fonti: il riepilogo calcolato, i giorni peggiori, gli ultimi sette,
  // i referti. Handle riassegnati in fila.
  const worstIds = new Set(summary.metrics.flatMap((m) => m.worst.map((d) => d.day)))
  const pick = ouraDocs.filter((d) => {
    const day = d.externalId.replace(/^day:/, '')
    return worstIds.has(day)
  })
  const recentSeven = ouraDocs.slice(0, 7).filter((d) => !pick.includes(d))
  const dayRefs = sourcesFromDocuments([...pick, ...recentSeven].slice(0, 10), 600)

  const offered: SourceRef[] = [
    summarySource(summary, correlations, 'F1'),
    ...dayRefs,
    ...healthDocs,
  ].map((ref, i) => ({ ...ref, handle: `F${i + 1}` }))

  if (!healthDays.length) {
    const report: CoachReport = {
      summary,
      correlations,
      osservazioni: [],
      consigli: [],
      dropped: 0,
      model: 'nessuno',
      healthDocuments: healthDocs.length,
    }
    await logRun({ agent: AGENT_KEY, question: `${days} giorni`, answer: { vuoto: true }, model: null, hits: 0, latencyMs: Date.now() - started })
    return report
  }

  const { data, model } = await runStructured<{ osservazioni?: RawClaim[]; consigli?: RawClaim[] }>({
    task: 'answer',
    system: SYSTEM,
    user: ['FONTI', '', formatSources(offered)].join('\n'),
    tool: TOOL,
    signal,
  })

  const osservazioni = verifyClaims(Array.isArray(data.osservazioni) ? data.osservazioni : [], offered)
  const consigli = verifyClaims(Array.isArray(data.consigli) ? data.consigli : [], offered)

  const report: CoachReport = {
    summary,
    correlations,
    osservazioni: osservazioni.claims,
    consigli: consigli.claims,
    dropped: osservazioni.dropped.length + consigli.dropped.length,
    model,
    healthDocuments: healthDocs.length,
  }

  await logRun({
    agent: AGENT_KEY,
    question: `${days} giorni`,
    answer: { days: summary.days, osservazioni: report.osservazioni.length, consigli: report.consigli.length, dropped: report.dropped },
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })

  return report
}
