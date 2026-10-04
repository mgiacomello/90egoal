import { INITIATIVE_AGENT, pulse } from '@/lib/brain/agents/initiatives'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { recentRuns } from '@/lib/brain/memory'

export const runtime = 'nodejs'
export const maxDuration = 120

/** Cosa i dirigenti ti hanno detto di loro iniziativa, negli ultimi giorni. */
export async function GET() {
  try {
    await requireOwner()
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const runs = await recentRuns(INITIATIVE_AGENT, since, 60)
    return Response.json({ initiatives: runs.map((r) => ({ ...(r.answer as Record<string, unknown>), at: r.createdAt })) })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere le iniziative.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Il polso adesso, a mano. */
export async function POST() {
  try {
    const owner = await requireOwner()
    const report = await pulse(owner.email)
    return Response.json(report)
  } catch (err) {
    const e = toBrainError(err, 'Il polso è fallito.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
