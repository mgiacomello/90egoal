import { BRIEF_AGENT, readOpenPoints, toMailBrief, writeBrief } from '@/lib/brain/agents/brief'
import { deliverBrief, deliveryConfigured } from '@/lib/brain/notify'
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

/**
 * Riscrive il brief adesso. Serve alla prima volta e quando hai fretta.
 *
 * Con `?deliver=1` lo manda anche sui canali configurati, saltando il
 * controllo su "vale la pena": al primo giro bisogna poter verificare
 * che la posta esca davvero, anche in una giornata senza niente da dire.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const deliver = new URL(request.url).searchParams.get('deliver') === '1'
    const brief = await writeBrief()
    const delivery = deliver ? await deliverBrief(toMailBrief(brief), true) : null

    return Response.json({
      brief: { ...brief, at: brief.generatedAt },
      puntiAperti: brief.puntiAperti.map((p) => ({ ...p, age: staleness(p.openedAt, new Date()) })),
      delivery,
      deliveryConfigured: deliveryConfigured(),
      now: new Date().toISOString(),
    })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a scrivere il brief.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
