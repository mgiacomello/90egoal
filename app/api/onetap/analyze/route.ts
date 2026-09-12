// ONE TAP — analisi di un'immagine.
//
// Il modello fa UNA cosa sola: trascrivere quello che si vede e, se è un
// messaggio, proporre tre risposte. La scelta dell'azione resta al motore
// deterministico in `lib/onetap/detect.ts`, così l'azione non può essere
// inventata: o l'entità è nel testo trascritto, o non viene proposta.
//
// Privacy: l'immagine attraversa questo handler in memoria e non viene mai
// scritta su disco, in database o nei log. Nessun endpoint la può rileggere.

import { analyze } from '@/lib/onetap/detect'
import type { Analysis, Lang } from '@/lib/onetap/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_URL = process.env.ONETAP_AI_BASE_URL ?? 'https://api.groq.com/openai/v1'
const API_KEY = process.env.ONETAP_AI_KEY ?? process.env.GROQ_API_KEY
const VISION_MODEL = process.env.ONETAP_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct'
const TEXT_MODEL = process.env.ONETAP_TEXT_MODEL ?? 'llama-3.3-70b-versatile'

/** ~8 MB di data URL: oltre, il client deve ricomprimere. */
const MAX_IMAGE_CHARS = 8_000_000

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  arr.push(now)
  hits.set(ip, arr)
  if (hits.size > 5000) hits.clear()
  return arr.length > MAX_PER_WINDOW
}

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-Content-Type-Options': 'nosniff' }

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

const SYSTEM = `You are the perception layer of ONE TAP. You never decide what the user should do.

Return ONLY a JSON object with these keys:
{
  "text": "every piece of text visible, transcribed verbatim, line by line",
  "kind": "message | event | contact | address | receipt | product | document | code | screen | other",
  "language": "ISO 639-1 code of the text",
  "replies": ["...", "...", "..."]
}

Rules:
- Transcribe exactly. Never invent, correct, complete or translate phone numbers, IBANs, addresses, codes, dates or amounts. If a character is unreadable, leave it out rather than guessing.
- Keep the reading order and the line breaks. Drop pure interface chrome (battery, signal, carrier).
- "replies" is a non-empty array of exactly 3 short, natural, ready-to-send answers ONLY when "kind" is "message" and the message is addressed to the reader. Write them in the same language as the message, first person, max 12 words each, no greetings unless natural, no emoji. Otherwise return an empty array.
- If the image contains no text at all, return "text" as a short factual description of the object, and kind "product" or "other".
- Output the JSON object and nothing else.`

interface ModelOutput {
  text: string
  kind: string
  language: string
  replies: string[]
}

function parseModelJson(raw: string): ModelOutput | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Partial<ModelOutput>
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      kind: typeof parsed.kind === 'string' ? parsed.kind : 'other',
      language: typeof parsed.language === 'string' ? parsed.language : '',
      replies: Array.isArray(parsed.replies)
        ? parsed.replies.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 3)
        : [],
    }
  } catch {
    return null
  }
}

interface ChatMessage {
  role: 'system' | 'user'
  content: string | Array<Record<string, unknown>>
}

async function callModel(model: string, messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages,
    }),
    signal,
  })
  if (!res.ok) {
    // Il corpo può contenere l'eco del prompt: si registra solo lo stato.
    throw Object.assign(new Error('upstream'), { status: res.status })
  }
  const data = await res.json()
  return String(data?.choices?.[0]?.message?.content ?? '')
}

/**
 * Controllo di stato: dice solo SE la lettura immagini è configurata.
 * Nessuna chiave, nessun modello, nessun dato: solo un booleano.
 */
export async function GET() {
  return json({ configured: !!API_KEY })
}

export async function POST(request: Request) {
  if (!API_KEY) {
    return json(
      { error: 'AI is not configured on this deployment.', code: 'AI_NOT_CONFIGURED' },
      503,
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return json({ error: 'Too many captures, slow down for a moment.', code: 'RATE_LIMITED' }, 429)
  }

  let image = ''
  let text = ''
  let lang: Lang | undefined
  try {
    const body = await request.json()
    image = typeof body?.image === 'string' ? body.image : ''
    text = typeof body?.text === 'string' ? body.text : ''
    if (body?.lang === 'it' || body?.lang === 'en') lang = body.lang
  } catch {
    return json({ error: 'Invalid request.', code: 'BAD_REQUEST' }, 400)
  }

  if (!image && !text) return json({ error: 'Nothing to analyse.', code: 'EMPTY' }, 400)
  if (image.length > MAX_IMAGE_CHARS) return json({ error: 'Image too large.', code: 'TOO_LARGE' }, 413)
  if (image && !/^data:image\/(png|jpe?g|webp|heic|heif);base64,/i.test(image)) {
    return json({ error: 'Unsupported image format.', code: 'BAD_IMAGE' }, 415)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    let output: ModelOutput | null = null

    if (image) {
      const raw = await callModel(
        VISION_MODEL,
        [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe this capture.' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        controller.signal,
      )
      output = parseModelJson(raw)
      if (!output || !output.text.trim()) {
        return json({ error: 'Nothing readable in that capture.', code: 'NO_CONTENT' }, 422)
      }
    } else {
      // Solo testo: il modello serve unicamente a scrivere le tre risposte.
      const raw = await callModel(
        TEXT_MODEL,
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Here is the text:\n\n${text.slice(0, 4000)}` },
        ],
        controller.signal,
      )
      output = parseModelJson(raw) ?? { text, kind: 'other', language: '', replies: [] }
      // Il testo dell'utente è la verità: il modello non lo riscrive.
      output.text = text
    }

    const result: Analysis = analyze(output.text, {
      lang: lang ?? (output.language?.toLowerCase().startsWith('it') ? 'it' : undefined),
      source: image ? 'image' : 'text',
      usedAI: true,
      replies: output.replies,
      hintKind: output.kind,
    })

    return json(result)
  } catch (err) {
    const status = (err as { status?: number }).status
    if ((err as Error).name === 'AbortError') {
      return json({ error: 'The analysis took too long. Try again.', code: 'TIMEOUT' }, 504)
    }
    if (status === 429) {
      return json({ error: 'The model is busy. Try again in a moment.', code: 'UPSTREAM_BUSY' }, 429)
    }
    console.error('[onetap] analyze failed', status ?? (err as Error).message)
    return json({ error: 'Could not analyse that capture.', code: 'UPSTREAM_ERROR' }, 502)
  } finally {
    clearTimeout(timeout)
  }
}
