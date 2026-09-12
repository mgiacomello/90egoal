// ONE TAP — analisi di un'immagine.
//
// Il modello fa UNA cosa sola: trascrivere quello che si vede e, se è un
// messaggio, proporre tre risposte. La scelta dell'azione resta al motore
// deterministico in `lib/onetap/detect.ts`, così l'azione non può essere
// inventata: o l'entità è nel testo trascritto, o non viene proposta.
//
// Privacy: l'immagine attraversa questo handler in memoria e non viene mai
// scritta su disco, in database o nei log. Nessun endpoint la può rileggere.

import Anthropic from '@anthropic-ai/sdk'
import { analyze } from '@/lib/onetap/detect'
import type { Analysis, Enrichment, Lang } from '@/lib/onetap/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Claude per primo quando c'è: sulle foto vere legge molto meglio, ed è la
// differenza fra un'azione giusta e una costruita su caratteri inventati.
const ANTHROPIC_KEY = process.env.ONETAP_ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY
const ANTHROPIC_MODEL = process.env.ONETAP_ANTHROPIC_MODEL ?? 'claude-opus-5'

// In alternativa, un endpoint OpenAI-compatibile (Groq e simili).
const BASE_URL = process.env.ONETAP_AI_BASE_URL ?? 'https://api.groq.com/openai/v1'
const OPENAI_KEY = process.env.ONETAP_AI_KEY ?? process.env.GROQ_API_KEY
const VISION_MODEL = process.env.ONETAP_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct'
const TEXT_MODEL = process.env.ONETAP_TEXT_MODEL ?? 'llama-3.3-70b-versatile'

const API_KEY = ANTHROPIC_KEY ?? OPENAI_KEY
const PROVIDER = ANTHROPIC_KEY ? 'anthropic' : OPENAI_KEY ? 'openai-compatible' : 'none'

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

const SYSTEM = `You are the perception layer of ONE TAP. You read what the user captured and prepare what they will most likely want to do next. You never decide the action: a separate deterministic engine does that from the transcribed text.

Return ONLY a JSON object with these keys:
{
  "text": "every piece of text visible, transcribed verbatim, line by line",
  "kind": "message | event | contact | address | receipt | product | document | code | screen | other",
  "language": "ISO 639-1 code of the text",
  "title": "what this is, in 3-7 words, in the text's language (e.g. 'Fattura Studio Rossi 2026/114', 'Biglietto da visita di Giulia Neri', 'Cena da Nobu venerdì')",
  "replies": ["...", "...", "..."],
  "event": {"title": "...", "location": "..."},
  "contact": {"name": "...", "company": "...", "role": "..."},
  "email_draft": {"subject": "...", "body": "..."},
  "message_draft": "...",
  "search_query": "..."
}

Rules for "text":
- Transcribe exactly. Never invent, correct, complete or translate phone numbers, IBANs, addresses, codes, dates or amounts. If a character is unreadable, leave it out rather than guessing.
- Keep the reading order and the line breaks. Drop pure interface chrome (battery, signal, carrier).
- If the image contains no text at all, put a short factual description of the object in "text" and use kind "product" or "other".

Rules for everything else (all optional — omit a key or use "" when it does not apply):
- "replies": exactly 3 short, natural, ready-to-send answers ONLY when kind is "message" and it is addressed to the reader. Same language and register as the message (formal stays formal), first person, max 14 words each, no emoji, no placeholders. Make them genuinely different: one that agrees, one that asks the one missing detail, one that declines or proposes an alternative. Otherwise [].
- "event": when there is an appointment, booking or deadline: a human title ("Cena con Anna da Nobu", not the raw line) and the location ONLY if it appears in the text.
- "contact": when there is a person or business with a phone or email: name, company, role — exactly as written, nothing invented.
- "email_draft": ONLY if an email address is visible: a subject and a 2-4 sentence body the reader would plausibly send to that address, in the text's language, ready to send, no placeholders like [name].
- "message_draft": ONLY if a phone number is visible: one short message (max 30 words) the reader would plausibly send, same language, no placeholders.
- "search_query": for a product, place, book, film or thing to look up: the best 3-8 word query.
- Output the JSON object and nothing else.`

interface ModelOutput {
  text: string
  kind: string
  language: string
  replies: string[]
  enrich: Enrichment
}

function parseModelJson(raw: string): ModelOutput | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
    const str = (v: unknown, max = 1200): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
    const obj = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
    const event = obj(parsed.event)
    const contact = obj(parsed.contact)
    const emailDraft = obj(parsed.email_draft)
    return {
      text: str(parsed.text, 20_000) ?? '',
      kind: str(parsed.kind, 40) ?? 'other',
      language: str(parsed.language, 10) ?? '',
      replies: Array.isArray(parsed.replies)
        ? parsed.replies.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 3)
        : [],
      enrich: {
        title: str(parsed.title, 80),
        event: { title: str(event.title, 80), location: str(event.location, 120) },
        contact: { name: str(contact.name, 80), company: str(contact.company, 80), role: str(contact.role, 80) },
        emailDraft: { subject: str(emailDraft.subject, 120), body: str(emailDraft.body, 1200) },
        messageDraft: str(parsed.message_draft, 400),
        searchQuery: str(parsed.search_query, 120),
      },
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
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

/** Spacchetta un data URL in quello che l'SDK si aspetta. */
function splitDataUrl(dataUrl: string): { mediaType: ImageMediaType; data: string } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const raw = match[1].toLowerCase()
  const mediaType = (raw === 'image/jpg' ? 'image/jpeg' : raw) as ImageMediaType
  return { mediaType, data: match[2] }
}

/**
 * Trascrizione con Claude. Anche qui il modello legge e basta: l'azione la
 * sceglie il motore deterministico su quello che è stato trascritto.
 */
async function transcribeWithClaude(
  image: string | null,
  text: string,
  signal: AbortSignal,
): Promise<string> {
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })

  const content: Anthropic.ContentBlockParam[] = []
  if (image) {
    const parts = splitDataUrl(image)
    if (!parts) throw Object.assign(new Error('bad image'), { status: 415 })
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: parts.mediaType, data: parts.data },
    })
    content.push({ type: 'text', text: 'Transcribe this capture.' })
  } else {
    content.push({ type: 'text', text: `Here is the text:\n\n${text.slice(0, 4000)}` })
  }

  const response = await client.messages.create(
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      // Trascrivere non richiede ragionamento profondo: effort basso significa
      // meno attesa fra lo scatto e l'azione, che qui è la metrica che conta.
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content }],
    },
    { signal },
  )

  if (response.stop_reason === 'refusal') {
    throw Object.assign(new Error('refused'), { status: 422 })
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

export async function GET() {
  return json({ configured: !!API_KEY, provider: PROVIDER })
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

    if (PROVIDER === 'anthropic') {
      const raw = await transcribeWithClaude(image || null, text, controller.signal)
      output = parseModelJson(raw)
      if (image) {
        if (!output || !output.text.trim()) {
          return json({ error: 'Nothing readable in that capture.', code: 'NO_CONTENT' }, 422)
        }
      } else {
        // Solo testo: il modello serve per risposte e bozze, non per riscrivere
        // il testo dell'utente, che resta la verità.
        output = output ?? { text, kind: 'other', language: '', replies: [], enrich: {} }
        output.text = text
      }
    } else if (image) {
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
      output = parseModelJson(raw) ?? { text, kind: 'other', language: '', replies: [], enrich: {} }
      // Il testo dell'utente è la verità: il modello non lo riscrive.
      output.text = text
    }

    const result: Analysis = analyze(output.text, {
      lang: lang ?? (output.language?.toLowerCase().startsWith('it') ? 'it' : undefined),
      source: image ? 'image' : 'text',
      usedAI: true,
      replies: output.replies,
      hintKind: output.kind,
      enrich: output.enrich,
    })

    return json(result)
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: 'The AI key was rejected.', code: 'BAD_KEY' }, 502)
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'The model is busy. Try again in a moment.', code: 'UPSTREAM_BUSY' }, 429)
    }
    const status = err instanceof Anthropic.APIError ? err.status : (err as { status?: number }).status
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
