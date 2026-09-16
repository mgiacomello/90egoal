import { createHash } from 'node:crypto'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { rememberDocuments } from '@/lib/brain/memory'

export const runtime = 'nodejs'

/**
 * Ingest a mano: incolli un testo e finisce in memoria come nota.
 *
 * Serve a due cose. La prima è pratica: un verbale, un passaggio di un
 * contratto, una cosa detta al telefono. La seconda è che rende la
 * memoria usabile da subito, prima ancora di collegare Google — e un
 * prodotto che funziona prima delle credenziali si prova, uno che le
 * pretende resta chiuso.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown
      body?: unknown
      occurredAt?: unknown
      url?: unknown
    }

    const text = String(body.body ?? '').trim()
    if (!text) return Response.json({ error: 'Il testo della nota è vuoto.' }, { status: 400 })

    const title = String(body.title ?? '').trim() || text.split('\n')[0].slice(0, 120)

    const rawDate = String(body.occurredAt ?? '').trim()
    const parsed = rawDate ? Date.parse(rawDate) : NaN
    const occurredAt = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString()

    // Id derivato dal contenuto: reincollare la stessa nota non la duplica.
    const externalId = createHash('sha1').update(`${title}\n${text}`).digest('hex').slice(0, 24)

    const result = await rememberDocuments([
      {
        source: 'manual',
        kind: 'note',
        externalId,
        title,
        body: text,
        occurredAt,
        url: String(body.url ?? '').trim() || null,
        participants: [],
        metadata: { origin: 'console' },
      },
    ])

    return Response.json({ ...result, title, occurredAt })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a salvare la nota.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
