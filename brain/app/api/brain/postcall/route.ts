import { debrief, listCalls } from '@/lib/brain/agents/postcall'
import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Le call recenti che hanno lasciato una trascrizione o gli appunti in Drive. */
export async function GET() {
  try {
    await requireOwner()
    return Response.json({ calls: await listCalls(20) })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere le call.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Il debrief di una call. */
export async function POST(request: Request) {
  try {
    const owner = await requireOwner()
    const body = (await request.json().catch(() => ({}))) as { documentId?: unknown }
    const documentId = String(body.documentId ?? '').trim()
    if (!documentId) throw new BrainError('Scegli una call.', 400)

    return Response.json(await debrief({ documentId, ownerEmail: owner.email, signal: request.signal }))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a fare il debrief.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
