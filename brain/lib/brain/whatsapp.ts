import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * WhatsApp, la parte che si può testare senza rete.
 *
 * È l'unica porta di BRAIN che **scrive** fuori dalla console, e per
 * questo è la più stretta di tutte:
 *
 *   - ogni richiesta in entrata porta la firma di Meta (HMAC-SHA256 con
 *     il segreto dell'app) e senza firma valida non viene nemmeno letta;
 *   - si accettano messaggi **da un numero solo**, quello del titolare,
 *     e si risponde **a quel numero solo**. Chiunque altro scriva al
 *     numero di BRAIN non riceve niente, e il suo testo non entra in
 *     memoria;
 *   - BRAIN non scrive mai a terzi: la promessa "nessun agente manda
 *     niente a nome tuo" resta vera, perché l'unico destinatario sei tu.
 */

export function verifySignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header) return false
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(header.trim())
  return a.length === b.length && timingSafeEqual(a, b)
}

export type InboundMessage = {
  id: string
  /** Il numero, cifre e basta: "393331234567". */
  from: string
  text: string
  /** ISO */
  at: string
}

/** I messaggi di testo dentro a un webhook di Meta, qualunque sia la forma del contorno. */
export function parseInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = []
  const entries = (payload as { entry?: unknown[] })?.entry ?? []
  for (const entry of Array.isArray(entries) ? entries : []) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? []
    for (const change of Array.isArray(changes) ? changes : []) {
      const value = (change as { value?: { messages?: unknown[] } })?.value
      for (const m of Array.isArray(value?.messages) ? value!.messages! : []) {
        const msg = m as { id?: string; from?: string; type?: string; timestamp?: string; text?: { body?: string } }
        if (msg.type !== 'text' || !msg.id || !msg.from) continue
        const text = String(msg.text?.body ?? '').trim()
        if (!text) continue
        const ts = Number(msg.timestamp)
        out.push({
          id: msg.id,
          from: String(msg.from).replace(/\D/g, ''),
          text,
          at: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
        })
      }
    }
  }
  return out
}

export function sameNumber(a: string | undefined, b: string | undefined): boolean {
  const x = (a ?? '').replace(/\D/g, '')
  const y = (b ?? '').replace(/\D/g, '')
  return x.length > 0 && x === y
}

export type Route =
  | { kind: 'ask'; executive: string; question: string }
  | { kind: 'board' }
  | { kind: 'convene' }
  | { kind: 'brief' }
  | { kind: 'agenda' }
  | { kind: 'draft'; title: string }
  | { kind: 'help' }

const EXEC_NAMES = ['grace', 'quinn', 'sterling', 'archer', 'harper', 'nova']

/**
 * Chi deve rispondere. "Sterling, quanto…" o "@archer …" sceglie il
 * dirigente; "brief", "board", "riunisci" sono comandi; tutto il resto
 * va a Grace.
 */
export function routeMessage(text: string): Route {
  const t = text.trim()
  const low = t.toLowerCase()
  if (/^(aiuto|help|\?)$/.test(low)) return { kind: 'help' }
  if (/^brief$/.test(low)) return { kind: 'brief' }
  if (/^(board|tavolo)$/.test(low)) return { kind: 'board' }
  if (/^(riunisci|riunione|convoca)( il board)?$/.test(low)) return { kind: 'convene' }
  if (/^agenda$/.test(low)) return { kind: 'agenda' }
  const draft = t.match(/^bozza[\s:]+(.+)$/i)
  if (draft) return { kind: 'draft', title: draft[1].trim() }

  const m = t.match(/^@?([A-Za-z]+)[\s,:–—-]+([\s\S]+)$/)
  if (m && EXEC_NAMES.includes(m[1].toLowerCase()) && m[2].trim()) {
    return { kind: 'ask', executive: m[1].toLowerCase(), question: m[2].trim() }
  }
  return { kind: 'ask', executive: 'grace', question: t }
}

/** WhatsApp accetta 4096 caratteri: si spezza sulle righe, mai a metà parola. */
export function chunkText(text: string, max = 3900): string[] {
  const out: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    const candidate = current ? `${current}\n${line}` : line
    if (candidate.length <= max) {
      current = candidate
      continue
    }
    if (current) out.push(current)
    current = line.length <= max ? line : line.slice(0, max)
  }
  if (current) out.push(current)
  return out
}

export type TextClaim = {
  text: string
  unverified?: string[]
  sources: { source: string; title: string; occurredAt: string }[]
}

const CHANNEL: Record<string, string> = {
  gmail: 'Email', gcal: 'Agenda', gdrive: 'Drive', qonto: 'Conto', oura: 'Anello', web: 'Web', manual: 'Nota', calc: 'Calcolo', board: 'Board',
}

function day(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Una risposta come si legge sul telefono: frasi, poi le fonti in piccolo. */
export function answerToText(name: string, claims: TextClaim[], openQuestions: string[]): string {
  const lines: string[] = [`*${name}*`]
  if (!claims.length) lines.push('Non risulta niente in memoria su questo.')
  for (const c of claims) {
    lines.push(`• ${c.text}`)
    const refs = c.sources.map((s) => `${CHANNEL[s.source] ?? s.source} ${day(s.occurredAt)}${s.title ? ` · ${s.title}` : ''}`).join(' | ')
    if (refs) lines.push(`  _${refs}_`)
    if (c.unverified?.length) lines.push(`  ⚠ ${c.unverified.join(', ')}: non nelle fonti citate`)
  }
  for (const q of openQuestions.slice(0, 3)) lines.push(`↳ ${q}`)
  return lines.join('\n')
}

/** Un riassunto in una riga, senza a capo: è tutto ciò che un template di Meta accetta. */
export function compactLine(text: string, max = 900): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export const HELP = [
  '*BRAIN su WhatsApp*',
  '• Scrivi una domanda: risponde Grace.',
  '• "Sterling, …" o "@archer …": risponde quel dirigente (Grace, Quinn, Sterling, Archer, Harper, Nova).',
  '• "brief": il brief di stamattina. "board": l\'ultimo board. "riunisci": riunisce il board adesso.',
  '• "agenda": l\'agenda del prossimo incontro. "bozza <oggetto>": una bozza di risposta a quella mail.',
  '• "mandati": le cose che ho in carico (check-in, pagamenti, inviti). "ok 7F2A" / "no 7F2A" per decidere, "fatto 7F2A" per chiudere.',
  '• "ricordami domani alle 9 di …": un promemoria. "comprami …", "paga …": lo segno e te lo tengo in lista.',
  'Ogni riga porta la sua fonte. Niente parte a nome tuo.',
].join('\n')
