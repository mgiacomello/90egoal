import { analyzeContract } from '@/lib/brain/agents/contracts'
import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import { documentById } from '@/lib/brain/memory'

export const runtime = 'nodejs'
// Un contratto lungo letto per intero non sta nei dieci secondi di default.
export const maxDuration = 300

/**
 * Analizza un contratto: o uno già in memoria, o un testo incollato.
 *
 * L'incollato serve più di quanto sembri: il contratto che ti manda la
 * controparte arriva per mail e lo vuoi guardare *prima* di deciderlo,
 * non dopo averlo archiviato.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      documentId?: unknown
      text?: unknown
      side?: unknown
    }

    const documentId = String(body.documentId ?? '').trim()
    let text = String(body.text ?? '').trim()
    let title: string | undefined

    if (documentId) {
      const doc = await documentById(documentId)
      if (!doc) throw new BrainError('Documento non trovato in memoria.', 404)
      text = doc.body
      title = doc.title
    }

    if (text.length < 200) {
      throw new BrainError(
        'Servono almeno 200 caratteri di contratto: sotto non c\'è abbastanza testo per dire qualcosa di utile.',
        400
      )
    }

    const analysis = await analyzeContract(text, {
      side: String(body.side ?? '').trim().slice(0, 120),
      title,
      signal: request.signal,
    })

    return Response.json({ ...analysis, documentId: documentId || null, title: title ?? null })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito ad analizzare il contratto.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
