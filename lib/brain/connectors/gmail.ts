import type { BrainDocument } from '../types'
import { decodeBase64Url, googleConfigured, googleConnection, googleJson } from './google'
import { clip, htmlToText, mapLimit, type Connector, type SyncWindow } from './types'

/**
 * Gmail: la mail che entra è l'innesco più ricco di contesto che esista.
 *
 * Di default si salta quello che non è lavoro (promozioni, social,
 * aggiornamenti): una memoria piena di newsletter risponde peggio di
 * una memoria piccola e pulita. `BRAIN_GMAIL_QUERY` sovrascrive il filtro.
 */

const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

type GmailHeader = { name: string; value: string }
type GmailPart = {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
}
type GmailMessage = {
  id: string
  threadId?: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: GmailPart
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

/** Scende nell'albero delle parti e prende il primo testo utile. */
function extractBody(part: GmailPart | undefined): string {
  if (!part) return ''

  const plain: string[] = []
  const html: string[] = []

  const walk = (node: GmailPart) => {
    // Gli allegati hanno un nome file: il loro contenuto non è il corpo.
    if (node.filename) return
    const data = node.body?.data
    if (data) {
      if (node.mimeType === 'text/plain') plain.push(decodeBase64Url(data))
      else if (node.mimeType === 'text/html') html.push(decodeBase64Url(data))
    }
    node.parts?.forEach(walk)
  }
  walk(part)

  if (plain.length) return plain.join('\n').trim()
  if (html.length) return htmlToText(html.join('\n'))
  return ''
}

/** Da "Mario Rossi <m@x.it>, a@b.it" a ["m@x.it", "a@b.it"]. */
function addresses(...values: string[]): string[] {
  const out = new Set<string>()
  for (const value of values) {
    for (const m of value.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]*\w/g)) out.add(m[0].toLowerCase())
  }
  return [...out]
}

/** Le citazioni del thread precedente raddoppiano la memoria senza aggiungerci nulla. */
function stripQuotedReplies(body: string): string {
  const cut = body.search(/\n(?:>{1,}\s|-{2,}\s*Messaggio originale|Il .* ha scritto:|On .* wrote:)/)
  return cut > 200 ? body.slice(0, cut).trim() : body.trim()
}

function toDocument(msg: GmailMessage): BrainDocument | null {
  const headers = msg.payload?.headers
  const subject = header(headers, 'Subject') || '(senza oggetto)'
  const from = header(headers, 'From')
  const to = header(headers, 'To')
  const cc = header(headers, 'Cc')

  const body = stripQuotedReplies(extractBody(msg.payload)) || msg.snippet || ''
  if (!body.trim() && subject === '(senza oggetto)') return null

  const occurredAt = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : new Date(header(headers, 'Date') || Date.now()).toISOString()

  return {
    source: 'gmail',
    kind: 'email',
    externalId: msg.id,
    title: subject,
    body: clip(`Da: ${from}\nA: ${to}${cc ? `\nCc: ${cc}` : ''}\n\n${body}`),
    occurredAt,
    url: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId ?? msg.id}`,
    participants: addresses(from, to, cc),
    metadata: { threadId: msg.threadId, labels: msg.labelIds ?? [] },
  }
}

function query(since: Date): string {
  const custom = process.env.BRAIN_GMAIL_QUERY?.trim()
  if (custom) return custom
  const d = since
  const after = `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return `after:${after} -in:spam -in:trash -category:promotions -category:social -category:forums`
}

export const gmailConnector: Connector = {
  key: 'gmail',
  label: 'Gmail',
  hint: 'OAuth Google in sola lettura. Filtro di default: niente promozioni, social, spam.',
  configured: googleConfigured,
  connected: async () => (await googleConnection()).connected,

  async fetch({ since, limit }: SyncWindow): Promise<BrainDocument[]> {
    const params = new URLSearchParams({
      q: query(since),
      maxResults: String(Math.min(limit, 100)),
    })
    const list = await googleJson<{ messages?: { id: string }[] }>(`${API}/messages?${params}`)
    const ids = (list.messages ?? []).map((m) => m.id)
    if (!ids.length) return []

    const messages = await mapLimit(ids, 5, (id) =>
      googleJson<GmailMessage>(`${API}/messages/${id}?format=full`)
    )
    return messages.map(toDocument).filter((d): d is BrainDocument => d !== null)
  },
}
