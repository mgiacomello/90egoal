import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import {
  closePoint,
  listOpenPoints,
  openPoint,
  reopenPoint,
  rephrasePoint,
  touchPoint,
  type SourceRefLike,
} from '@/lib/brain/memory'
import { decidePoints, fingerprint } from '@/lib/brain/openpoints'

export const runtime = 'nodejs'

/**
 * Chiudere un punto aperto.
 *
 * È l'unico modo in cui un punto si chiude, e non è una limitazione:
 * è il motivo per cui la lista è credibile. Un sistema che chiude da
 * solo quello di cui nessuno parla più non è una memoria, è un
 * dimenticatoio con una barra di avanzamento.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown
      action?: unknown
      note?: unknown
      text?: unknown
      texts?: unknown
      citations?: unknown
    }

    const action = String(body.action ?? 'close')

    // Aprire punti a mano — per esempio gli impegni presi in una call.
    // Passa dallo stesso riconoscimento del brief: un punto che c'è già
    // non si duplica, e la sua età non si azzera.
    if (action === 'open') {
      const texts = (Array.isArray(body.texts) ? body.texts : [])
        .map((t) => String(t ?? '').trim().slice(0, 500))
        .filter((t) => t.length >= 3)
      if (!texts.length) throw new BrainError('Niente da aprire.', 400)
      const citations = (Array.isArray(body.citations) ? body.citations : [])
        .filter((c): c is SourceRefLike => Boolean(c && typeof c === 'object' && 'title' in c))
        .slice(0, 5)
      const existing = await listOpenPoints()
      for (const decision of decidePoints(texts, existing)) {
        if (decision.action === 'keep') await touchPoint(decision.id)
        else await openPoint({ text: decision.text, fingerprint: decision.fingerprint, citations })
      }
      return Response.json({ puntiAperti: await listOpenPoints() })
    }

    const id = String(body.id ?? '').trim()
    if (!id) throw new BrainError('Manca l\'id del punto.', 400)

    if (action === 'reopen') {
      await reopenPoint(id)
    } else if (action === 'rephrase') {
      // Riscrivere un punto non è chiuderlo e riaprirlo: l'età resta,
      // perché da quanto lo rimandi è l'unica cosa che conta davvero.
      const text = String(body.text ?? '').trim().slice(0, 500)
      if (text.length < 3) throw new BrainError('Il punto riformulato è vuoto.', 400)
      await rephrasePoint(id, text, fingerprint(text))
    } else {
      await closePoint(id, String(body.note ?? '').trim().slice(0, 500) || undefined)
    }

    return Response.json({ puntiAperti: await listOpenPoints() })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito ad aggiornare il punto.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
