/**
 * La posta che aspetta te. Funzione pura: niente rete, niente DOM,
 * nessun import di valori.
 *
 * Non è un riassunto della casella, e non è una classificazione fatta
 * da un modello. È un fatto strutturato: **in questo thread l'ultimo a
 * scrivere non sei tu, e da allora sono passati N giorni.** Si calcola
 * dai messaggi, si ordina per età, e la riga più vecchia è quella che
 * sta costando di più in reputazione.
 *
 * Il rumore — newsletter, notifiche, promozioni — si toglie prima, con
 * regole, non con giudizio: un `noreply@` non aspetta niente da nessuno.
 */

export type MailLike = {
  id: string
  threadId: string
  title: string
  /** ISO */
  occurredAt: string
  /** Mittente, minuscolo. */
  from: string
  /** Destinatari diretti (A:), minuscoli. */
  to: string[]
  labels: string[]
  url: string | null
  body: string
}

export type WaitingThread = {
  threadId: string
  /** L'ultimo messaggio, quello a cui si risponde. */
  documentId: string
  title: string
  from: string
  lastAt: string
  ageDays: number
  messages: number
  /** Eri fra i destinatari diretti, non in copia. */
  direct: boolean
  /** C'è una domanda o una richiesta esplicita. */
  asks: boolean
  url: string | null
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

/** "Da: Mario Rossi <m@x.it>" in testa al corpo → m@x.it. */
export function senderOf(body: string): string | null {
  const line = body.match(/^Da:\s*(.*)$/m)?.[1] ?? ''
  return line.match(EMAIL)?.[0]?.toLowerCase() ?? null
}

/** "A: …" in testa al corpo → gli indirizzi. */
export function recipientsOf(body: string): string[] {
  const line = body.match(/^A:\s*(.*)$/m)?.[1] ?? ''
  return [...new Set([...line.matchAll(EMAIL)].map((m) => m[0].toLowerCase()))]
}

const NOISE_SENDER = /^(no-?reply|noreply|notifications?|notifiche|newsletter|news|info|mailer|bounce|do-?not-?reply|alert|updates?|team|hello|support|marketing|digest)[@.+-]/i
const NOISE_LABELS = new Set(['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'CATEGORY_UPDATES', 'SPAM', 'TRASH'])

export function isNoise(from: string, labels: string[]): boolean {
  if (NOISE_SENDER.test(from)) return true
  return labels.some((l) => NOISE_LABELS.has(l.toUpperCase()))
}

const ASK = /\?|fammi sapere|facci sapere|puoi|potresti|potrebbe|attendo|in attesa|conferm|riscontro|cortese|gentilmente|entro il|urgente|sollecit/i

export function asksSomething(body: string): boolean {
  return ASK.test(body)
}

function ageInDays(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000))
}

/**
 * I thread in cui l'ultima parola non è tua, da almeno `minDays`
 * giorni. Un thread in cui hai risposto dopo l'ultimo messaggio altrui
 * non c'è; un thread in cui l'ultimo messaggio è tuo nemmeno.
 */
export function waitingOnMe(mails: MailLike[], owner: string, now: Date, minDays = 1): WaitingThread[] {
  const me = owner.toLowerCase()
  const threads = new Map<string, MailLike[]>()
  for (const m of mails) {
    const key = m.threadId || m.id
    const list = threads.get(key) ?? []
    list.push(m)
    threads.set(key, list)
  }

  const out: WaitingThread[] = []
  for (const [threadId, list] of threads) {
    const sorted = [...list].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    const last = sorted[sorted.length - 1]
    if (last.from === me) continue
    if (isNoise(last.from, last.labels)) continue
    const age = ageInDays(last.occurredAt, now)
    if (age < minDays) continue
    out.push({
      threadId,
      documentId: last.id,
      title: last.title,
      from: last.from,
      lastAt: last.occurredAt,
      ageDays: age,
      messages: sorted.length,
      direct: last.to.includes(me),
      asks: asksSomething(last.body),
      url: last.url,
    })
  }

  const weight = (t: WaitingThread) => (t.direct ? 2 : 0) + (t.asks ? 1 : 0)
  return out.sort((a, b) => weight(b) - weight(a) || b.ageDays - a.ageDays)
}
