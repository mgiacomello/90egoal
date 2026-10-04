import { logRun, upcomingEvents } from '../memory'
import { freeSlots, parseWhen, proposalText, type Busy, type Slot } from '../slots'

/**
 * L'agente Appuntamenti.
 *
 * La "GiorgiaAI" del post fissa gli appuntamenti. Questa no, per
 * scelta: BRAIN non scrive in agenda e non manda mail. Fa la parte che
 * costa tempo — guarda l'agenda, trova tre finestre decenti, scrive la
 * mail di proposta — e si ferma un passo prima del gesto, che resta
 * tuo. Niente modello: un'agenda si legge, non si immagina.
 */

const AGENT_KEY = 'slots'

export type SlotsReport = {
  days: number
  durationMin: number
  busy: number
  slots: Slot[]
  text: string | null
}

export async function proposeSlots(options: { days?: number; durationMin?: number; topic?: string } = {}): Promise<SlotsReport> {
  const started = Date.now()
  const days = options.days ?? 10
  const durationMin = options.durationMin ?? 60

  const events = await upcomingEvents(days + 1, 200)
  const busy: Busy[] = []
  for (const e of events) {
    const line = e.body.match(/^Quando:\s*(.*)$/m)?.[1]
    const parsed = line ? parseWhen(line) : null
    if (parsed) busy.push(parsed)
    else busy.push({ start: e.occurredAt, end: new Date(Date.parse(e.occurredAt) + 3_600_000).toISOString() })
  }

  const slots = freeSlots(busy, { from: new Date(), days, durationMin, count: 3 })
  const report: SlotsReport = { days, durationMin, busy: busy.length, slots, text: proposalText(slots, options.topic) }

  await logRun({
    agent: AGENT_KEY,
    question: `${slots.length} finestre da ${durationMin} min nei prossimi ${days} giorni`,
    answer: { busy: busy.length, slots: slots.length },
    model: 'nessuno (deterministico)',
    hits: busy.length,
    latencyMs: Date.now() - started,
  })
  return report
}
