import { verifyClaims } from '../cite'
import { logRun, recentDocuments } from '../memory'
import { runStructured } from '../model'
import { summarize, type TrainingDay, type TrainingSummary, type Workout } from '../training'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type StoredDocument, type VerifiedClaim } from '../types'

/**
 * L'agente Allenamento.
 *
 * "Sto facendo sport bene?" Stessa divisione del lavoro del Coach, e
 * per la stessa ragione: **i numeri li fa il codice** — frequenza, mix
 * di intensità, giorni di fila, prontezza il giorno dopo, HRV e
 * frequenza a riposo — e il verdetto con le sue ragioni è calcolato.
 * Il modello legge quei numeri e dice cosa cambiare la settimana
 * prossima, citando il riepilogo e le singole sedute.
 *
 * Non è un parere medico, né un piano d'allenamento: è un anello letto
 * con attenzione.
 */

const AGENT_KEY = 'training'

export type TrainingReport = {
  summary: TrainingSummary
  osservazioni: VerifiedClaim[]
  consigli: VerifiedClaim[]
  dropped: number
  model: string
}

const TOOL = {
  name: 'allena',
  description: 'Commenta i numeri dell\'allenamento e propone cosa cambiare, citando le fonti.',
  input_schema: {
    type: 'object' as const,
    properties: {
      osservazioni: {
        type: 'array',
        description: 'Cosa dicono i numeri, due o tre frasi, ognuna con le fonti.',
        items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] },
      },
      consigli: {
        type: 'array',
        description: 'Cosa cambiare la settimana prossima: concreto, al massimo tre, ognuno collegato a un\'osservazione tramite le fonti.',
        items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] },
      },
    },
    required: ['osservazioni', 'consigli'],
  },
}

const SYSTEM = `Sei un allenatore che segue una persona adulta e impegnata. Hai davanti i numeri delle sue ultime settimane, già calcolati, con un verdetto e le sue ragioni.

Scrivi in italiano, per punti, frasi brevi. Niente "ottimo lavoro", niente moralismi.

REGOLE NON NEGOZIABILI
1. Ogni frase deve venire dalle FONTI e dichiarare da quali, con il loro handle (F1, F2…). Una frase senza handle valido viene scartata automaticamente.
2. I numeri sono già nel RIEPILOGO CALCOLATO: copiali esattamente. Non ricalcolare, non stimare, non arrotondare. Un controllo automatico confronta ogni numero con le fonti citate.
3. Parti dagli avvisi del verdetto, se ce ne sono: sono le cose da cambiare. Se il verdetto è buono, dillo in una riga e proponi al massimo un ritocco.
4. I consigli sono concreti e verificabili la settimana dopo: "una seduta facile di 40 minuti il giovedì al posto della seconda dura", non "allenati con più equilibrio".
5. NON sei un medico. Non diagnosticare, non interpretare sintomi. Se i segnali (frequenza a riposo, HRV, prontezza) suggeriscono qualcosa che va guardato, dì esattamente "vale la pena parlarne con il tuo medico", senza dire cosa.
6. Con meno di sei sedute nel periodo, dillo prima di tutto e limitati a un'osservazione.`

function fmt(v: number | null): string {
  return v === null ? '—' : String(v).replace('.', ',')
}

function toDay(doc: StoredDocument): TrainingDay | null {
  const m = doc.metadata ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const day = doc.externalId.startsWith('day:') ? doc.externalId.slice(4) : doc.occurredAt.slice(0, 10)
  const workouts: Workout[] = Array.isArray(m.workouts)
    ? (m.workouts as Record<string, unknown>[]).map((w) => ({
        day,
        activity: String(w.activity ?? 'attività'),
        intensity: w.intensity === 'easy' || w.intensity === 'moderate' || w.intensity === 'hard' ? w.intensity : null,
        minutes: num(w.minutes) ?? 0,
        calories: num(w.calories),
      }))
    : []
  return {
    day,
    workouts,
    steps: num(m.steps),
    highMin: num(m.highMin),
    mediumMin: num(m.mediumMin),
    readiness: num(m.readinessScore),
    sleep: num(m.sleepScore),
    hrv: num(m.hrv),
    restingHr: num(m.restingHr),
  }
}

function summarySource(s: TrainingSummary, handle: string): SourceRef {
  const lines = [
    `Finestra: dal ${s.from ?? '—'} al ${s.to ?? '—'}, ${s.days} giorni con dati, ${s.sessions} sedute per ${s.minutes} minuti.`,
    `Sedute medie a settimana (settimane complete): ${fmt(s.perWeek)}.`,
    `Mix: ${s.mix.easy} facili, ${s.mix.moderate} moderate, ${s.mix.hard} dure su ${s.mix.total}.`,
    `Giorni di fila al massimo: ${s.longestStreak}.`,
    `Prontezza il giorno dopo una seduta dura: ${fmt(s.recovery.afterHard)}; negli altri giorni: ${fmt(s.recovery.baseline)}; differenza ${fmt(s.recovery.delta)}.`,
    `Sonno la notte dopo l'allenamento: ${fmt(s.sleepAfter.afterTraining)}; le altre notti: ${fmt(s.sleepAfter.otherNights)}; differenza ${fmt(s.sleepAfter.delta)}.`,
    `HRV: ${s.hrvTrend}. Frequenza a riposo: ${s.restingHrTrend}.`,
    '',
    `VERDETTO: ${s.verdict.ok ? 'stai facendo bene' : 'qualcosa da cambiare'}.`,
    ...s.verdict.good.map((g) => `  bene: ${g}`),
    ...s.verdict.warnings.map((w) => `  avviso: ${w}`),
    '',
    'SETTIMANE:',
    ...s.weeks.map((w) => `  settimana dal ${w.week}: ${w.sessions} sedute, ${w.minutes} min, ${w.hard} dure`),
  ]
  return {
    handle,
    documentId: 'calc:training',
    source: 'calc',
    kind: 'note',
    title: 'Riepilogo calcolato dell\'allenamento',
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

export async function reviewTraining(days = 28, signal?: AbortSignal): Promise<TrainingReport> {
  const started = Date.now()
  const since = Date.now() - days * 86_400_000
  const today = new Date().toISOString().slice(0, 10)

  const docs = (await recentDocuments(200, 'oura')).filter((d) => Date.parse(d.occurredAt) >= since)
  const dayDocs = docs.filter((d) => d.externalId.startsWith('day:'))
  const workoutDocs = docs.filter((d) => d.externalId.startsWith('workout:')).slice(0, 10)

  const trainingDays = dayDocs.map(toDay).filter((d): d is TrainingDay => d !== null)
  const summary = summarize(trainingDays, today)

  const offered: SourceRef[] = [
    summarySource(summary, 'F1'),
    ...workoutDocs.map((d) => ({
      handle: '',
      documentId: d.id,
      source: 'oura' as const,
      kind: 'health' as const,
      title: d.title,
      occurredAt: d.occurredAt,
      url: null,
      excerpt: d.body.slice(0, 600),
    })),
  ].map((ref, i) => ({ ...ref, handle: `F${i + 1}` }))

  if (!summary.sessions) {
    await logRun({ agent: AGENT_KEY, question: `${days} giorni`, answer: { vuoto: true, days: summary.days }, model: null, hits: 0, latencyMs: Date.now() - started })
    return { summary, osservazioni: [], consigli: [], dropped: 0, model: 'nessuno' }
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

  const report: TrainingReport = {
    summary,
    osservazioni: osservazioni.claims,
    consigli: consigli.claims,
    dropped: osservazioni.dropped.length + consigli.dropped.length,
    model,
  }
  await logRun({
    agent: AGENT_KEY,
    question: `${days} giorni`,
    answer: { sessions: summary.sessions, ok: summary.verdict.ok, warnings: summary.verdict.warnings.length, dropped: report.dropped },
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })
  return report
}
