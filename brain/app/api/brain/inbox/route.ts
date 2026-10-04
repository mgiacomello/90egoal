import { draftReply, reviewInbox } from '@/lib/brain/agents/inbox'
import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 120

/** I thread in cui l'ultima parola non è tua. */
export async function GET(request: Request) {
  try {
    const owner = await requireOwner()
    const raw = Number(new URL(request.url).searchParams.get('minDays') ?? 1)
    const minDays = Number.isFinite(raw) && raw >= 0 ? Math.min(raw, 60) : 1
    return Response.json(await reviewInbox(owner.email, minDays))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere la posta.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Una bozza di risposta, verificata paragrafo per paragrafo. Non parte da qui. */
export async function POST(request: Request) {
  try {
    const owner = await requireOwner()
    const body = (await request.json().catch(() => ({}))) as { documentId?: unknown }
    const documentId = String(body.documentId ?? '').trim()
    if (!documentId) throw new BrainError('Scegli una mail.', 400)
    return Response.json(await draftReply(documentId, owner.email, request.signal))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a scrivere la bozza.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
