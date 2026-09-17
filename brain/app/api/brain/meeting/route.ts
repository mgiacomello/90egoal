import { prepareMeeting } from '@/lib/brain/agents/meeting'
import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import { upcomingEvents } from '@/lib/brain/memory'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Gli incontri per cui ha senso prepararsi: da adesso ai prossimi giorni. */
export async function GET() {
  try {
    await requireOwner()
    const events = await upcomingEvents(14)
    return Response.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        occurredAt: e.occurredAt,
        participants: e.participants,
        url: e.url,
      })),
    })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere il calendario.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** L'agenda, costruita da quello che è già stato detto. */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      eventId?: unknown
      who?: unknown
      topic?: unknown
    }

    const eventId = String(body.eventId ?? '').trim()
    const who = String(body.who ?? '').trim().slice(0, 300)
    const topic = String(body.topic ?? '').trim().slice(0, 300)

    if (!eventId && !who) {
      throw new BrainError('Scegli un incontro dal calendario, oppure scrivi con chi.', 400)
    }

    return Response.json(
      await prepareMeeting({ eventId: eventId || undefined, who, topic, signal: request.signal })
    )
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a preparare l\'incontro.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
