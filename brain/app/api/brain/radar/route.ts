import { scanRadar } from '@/lib/brain/agents/radar'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 180

/** Segnali di mercato, prospettive e cosa significano per il titolare. */
export async function GET(request: Request) {
  try {
    await requireOwner()
    const raw = Number(new URL(request.url).searchParams.get('days') ?? 7)
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 30) : 7
    return Response.json(await scanRadar(days, request.signal))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere il radar.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
