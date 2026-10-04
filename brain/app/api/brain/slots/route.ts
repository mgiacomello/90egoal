import { proposeSlots } from '@/lib/brain/agents/slots'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Tre finestre libere e la mail per proporle. Non fissa niente. */
export async function GET(request: Request) {
  try {
    await requireOwner()
    const params = new URL(request.url).searchParams
    const days = Math.min(Math.max(Number(params.get('days') ?? 10) || 10, 1), 30)
    const durationMin = Math.min(Math.max(Number(params.get('duration') ?? 60) || 60, 15), 240)
    const topic = String(params.get('topic') ?? '').slice(0, 120)
    return Response.json(await proposeSlots({ days, durationMin, topic }))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere l\'agenda.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
