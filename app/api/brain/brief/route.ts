import { BRIEF_AGENT, readOpenPoints, writeBrief } from '@/lib/brain/agents/brief'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { lastRun } from '@/lib/brain/memory'
import { staleness } from '@/lib/brain/openpoints'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Il brief già scritto, più i punti aperti aggiornati a adesso.
 *
 * Non ne genera uno nuovo: quello lo fa il cron, la notte. Aprire la
 * console non deve costare una chiamata al modello — e soprattutto il
 * brief che leggi deve essere *quello*, non una versione diversa
 * riscritta perché hai ricaricato la pagina.
 */
export async function GET() {
  try {
    await requireOwner()

    const now = new Date()
    const [run, points] = await Promise.all([lastRun(BRIEF_AGENT), readOpenPoints(now)])

    return Response.json({
      brief: run ? { ...(run.answer as Record<string, unknown>), at: run.createdAt } : null,
      puntiAperti: points,
      // L'età si ricalcola adesso: un punto invecchia anche se il brief no.
      now: now.toISOString(),
    })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere il brief.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Riscrive il brief adesso. Serve alla prima volta e quando hai fretta. */
export async function POST() {
  try {
    await requireOwner()
    const brief = await writeBrief()
    return Response.json({
      brief: { ...brief, at: brief.generatedAt },
      puntiAperti: brief.puntiAperti.map((p) => ({ ...p, age: staleness(p.openedAt, new Date()) })),
      now: new Date().toISOString(),
    })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a scrivere il brief.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
