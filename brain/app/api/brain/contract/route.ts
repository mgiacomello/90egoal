import { analyzeContract } from '@/lib/brain/agents/contracts'
import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import { documentById } from '@/lib/brain/memory'
import { MAX_PDF_BYTES, extractPdfText } from '@/lib/brain/pdf'

export const runtime = 'nodejs'
// Un contratto lungo letto per intero non sta nei dieci secondi di default.
export const maxDuration = 300

type Input = { text: string; title?: string; side: string }

/** Il PDF caricato dal browser: si legge qui, non si salva da nessuna parte. */
async function fromUpload(request: Request): Promise<Input> {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new BrainError('Nessun file ricevuto.', 400)

  if (file.size > MAX_PDF_BYTES) {
    throw new BrainError(
      `PDF troppo grande (${Math.round(file.size / 1048576)} MB, il limite è ${MAX_PDF_BYTES / 1048576} MB).`,
      413
    )
  }

  const extraction = await extractPdfText(new Uint8Array(await file.arrayBuffer()))
  if (extraction.quality !== 'ok') {
    // Il limite si dice, non si aggira restituendo quattro righe di intestazione.
    throw new BrainError(
      `${extraction.note} Copia e incolla il testo, oppure passa da un PDF con livello di testo.`,
      422
    )
  }

  return {
    text: extraction.text,
    title: file.name,
    side: String(form.get('side') ?? '').trim().slice(0, 120),
  }
}

async function fromJson(request: Request): Promise<Input> {
  const body = (await request.json().catch(() => ({}))) as {
    documentId?: unknown
    text?: unknown
    side?: unknown
  }

  const side = String(body.side ?? '').trim().slice(0, 120)
  const documentId = String(body.documentId ?? '').trim()

  if (documentId) {
    const doc = await documentById(documentId)
    if (!doc) throw new BrainError('Documento non trovato in memoria.', 404)
    return { text: doc.body, title: doc.title, side }
  }

  return { text: String(body.text ?? '').trim(), side }
}

/**
 * Analizza un contratto: uno già in memoria, un testo incollato, o un
 * PDF caricato al volo.
 *
 * L'ultimo caso serve più di quanto sembri: il contratto che ti manda
 * la controparte arriva per mail e lo vuoi guardare *prima* di
 * deciderlo, non dopo averlo archiviato. Il file non viene salvato:
 * passa in memoria, si estrae il testo, e finisce lì.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const isUpload = (request.headers.get('content-type') ?? '').includes('multipart/form-data')
    const input = isUpload ? await fromUpload(request) : await fromJson(request)

    if (input.text.length < 200) {
      throw new BrainError(
        'Servono almeno 200 caratteri di contratto: sotto non c\'è abbastanza testo per dire qualcosa di utile.',
        400
      )
    }

    const analysis = await analyzeContract(input.text, {
      side: input.side,
      title: input.title,
      signal: request.signal,
    })

    return Response.json({ ...analysis, title: input.title ?? null })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito ad analizzare il contratto.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
