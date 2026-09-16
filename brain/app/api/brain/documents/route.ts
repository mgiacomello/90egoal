import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { forgetDocument, recentDocuments } from '@/lib/brain/memory'
import { SOURCES, type SourceKey } from '@/lib/brain/types'

export const runtime = 'nodejs'

/** Sfogliare la memoria: serve a fidarsi di quello che c'è dentro. */
export async function GET(request: Request) {
  try {
    await requireOwner()

    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 30)
    const rawSource = url.searchParams.get('source')
    const source = SOURCES.includes(rawSource as SourceKey) ? (rawSource as SourceKey) : undefined

    const documents = await recentDocuments(Number.isFinite(limit) ? limit : 30, source)
    // Il corpo intero non serve a un elenco, e sono i dati più sensibili che ci siano.
    return Response.json({
      documents: documents.map((d) => ({ ...d, body: d.body.slice(0, 400) })),
    })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere la memoria.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Dimenticare. Un secondo cervello senza questo tasto non è accettabile. */
export async function DELETE(request: Request) {
  try {
    await requireOwner()

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return Response.json({ error: 'Manca l\'id del documento.' }, { status: 400 })

    await forgetDocument(id)
    return Response.json({ ok: true })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a cancellare.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
