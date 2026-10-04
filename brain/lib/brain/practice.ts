/**
 * Lo studio: pratiche, tempo, fatturato. Funzione pura: niente rete,
 * niente DOM, nessun import di valori.
 *
 * Per un avvocato la contabilità comincia prima della fattura: comincia
 * dal tempo. Qui si stima dal calendario e dalla posta — un incontro
 * vale la sua durata, una mail scritta dieci minuti, una ricevuta
 * cinque — e si mette accanto agli incassi di quel cliente. Non è il
 * timesheet, e non pretende di esserlo: è il modo per vedere **chi
 * sta assorbendo ore senza che ci sia una fattura dietro**, che è la
 * domanda che un direttore di studio fa ogni lunedì.
 *
 * Tre altre cose che uno studio deve vedere e nessuno guarda:
 * - un cliente con cui si lavora da settimane e **nessuna lettera di
 *   incarico** in memoria;
 * - un **nome nuovo** di questa settimana, che è il momento del
 *   controllo dei conflitti — lo fa il titolare, ma qualcuno deve
 *   dirgli che il nome è nuovo;
 * - i contratti vicini a una finestra di disdetta, che stanno già in
 *   Scadenze.
 */

export type TouchLike = {
  id: string
  /** 'email' | 'event' */
  kind: string
  title: string
  occurredAt: string
  participants: string[]
  /** Durata dell'evento in minuti, se c'è. */
  minutes: number | null
  /** La mail l'ha scritta il titolare. */
  fromOwner: boolean
}

export type InvoiceLike = {
  id: string
  counterparty: string
  amountCents: number
  occurredAt: string
}

export type DocLike = {
  id: string
  title: string
  occurredAt: string
}

export type Matter = {
  key: string
  label: string
  emails: string[]
  touches: number
  /** Ore stimate nella finestra. */
  hours: number
  /** Ore stimate dopo l'ultima fattura (o tutte, se non c'è). */
  unbilledHours: number
  firstTouchAt: string
  lastTouchAt: string
  lastInvoiceAt: string | null
  lastInvoiceCents: number | null
  /** Incassato da questo cliente nella finestra. */
  invoicedCents: number
  /** Una lettera di incarico, un mandato, un preventivo in memoria. */
  engagement: DocLike | null
  /** Il primo contatto è di questa settimana. */
  isNew: boolean
  recentIds: string[]
}

const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.it', 'hotmail.com', 'hotmail.it', 'live.com', 'live.it',
  'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com', 'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'tin.it',
  'pec.it', 'legalmail.it', 'proton.me', 'protonmail.com', 'fastwebnet.it', 'email.it', 'aruba.it',
])

const NOISE = /^(no-?reply|noreply|notifications?|notifiche|newsletter|news|mailer|bounce|do-?not-?reply|alert|updates?|calendar-notification|drive-shares-noreply|hello|support|marketing|digest)[@.+-]/i
const SERVICE_DOMAIN = /@(?:.*\.)?(?:google\.com|vercel\.com|github\.com|linkedin\.com|slack\.com|notion\.so|stripe\.com|qonto\.com|apple\.com|amazon\.\w+)$/i
const STOP = new Set(['srl', 'spa', 'sas', 'snc', 'ltd', 'llc', 'inc', 'gmbh', 'sarl', 'studio', 'legale', 'avv', 'avvocati', 'the', 'and', 'bonifico', 'fattura', 'pagamento', 'saldo', 'acconto'])
const ENGAGEMENT = /incarico|mandato|engagement|preventivo|proposta di collaborazione|retainer|lettera d.incarico|conferimento/i

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function matterKey(email: string): string {
  const [, domain = ''] = email.toLowerCase().split('@')
  return FREEMAIL.has(domain) ? email.toLowerCase() : domain
}

/** Le parole con cui un cliente si riconosce in una fattura o in un titolo. */
export function matterTokens(key: string, emails: string[]): string[] {
  const out = new Set<string>()
  const add = (t: string) => {
    if (t.length >= 4 && !STOP.has(t)) out.add(t)
  }
  if (key.includes('@')) {
    for (const t of fold(key.split('@')[0]).split(/[^a-z0-9]+/)) add(t)
  } else {
    add(fold(key.split('.')[0]))
  }
  for (const e of emails) for (const t of fold(e.split('@')[0]).split(/[^a-z0-9]+/)) add(t)
  return [...out]
}

function mentions(text: string, tokens: string[]): boolean {
  const f = fold(text)
  return tokens.some((t) => f.includes(t))
}

/** Un incontro vale la sua durata; una mail scritta dieci minuti, una ricevuta cinque. */
export function estimateMinutes(t: TouchLike): number {
  if (t.kind === 'event') return t.minutes && t.minutes > 0 ? Math.min(t.minutes, 8 * 60) : 60
  return t.fromOwner ? 10 : 5
}

function labelOf(key: string, emails: string[]): string {
  if (key.includes('@')) return key
  const org = key.split('.')[0]
  return `${org.charAt(0).toUpperCase()}${org.slice(1)}${emails.length > 1 ? ` (${emails.length} persone)` : ''}`
}

export function buildMatters(
  touches: TouchLike[],
  invoices: InvoiceLike[],
  docs: DocLike[],
  owner: string,
  now = new Date()
): Matter[] {
  const me = owner.toLowerCase()
  const myDomain = matterKey(me)
  const groups = new Map<string, { emails: Set<string>; docs: TouchLike[] }>()

  for (const t of touches) {
    for (const raw of t.participants) {
      const email = raw.toLowerCase()
      if (email === me || NOISE.test(email) || SERVICE_DOMAIN.test(email)) continue
      const key = matterKey(email)
      if (!key.includes('@') && key === myDomain) continue
      const g = groups.get(key) ?? { emails: new Set<string>(), docs: [] }
      g.emails.add(email)
      if (!g.docs.some((d) => d.id === t.id)) g.docs.push(t)
      groups.set(key, g)
    }
  }

  const weekAgo = now.getTime() - 7 * 86_400_000
  const out: Matter[] = []
  for (const [key, g] of groups) {
    const sorted = [...g.docs].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    const emails = [...g.emails].sort()
    const tokens = matterTokens(key, emails)

    const mine = invoices
      .filter((i) => mentions(i.counterparty, tokens))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    const lastInvoice = mine[mine.length - 1] ?? null
    const sinceInvoice = lastInvoice ? Date.parse(lastInvoice.occurredAt) : 0

    const minutes = sorted.reduce((s, t) => s + estimateMinutes(t), 0)
    const unbilledMinutes = sorted.filter((t) => Date.parse(t.occurredAt) > sinceInvoice).reduce((s, t) => s + estimateMinutes(t), 0)

    const engagement = docs.find((d) => ENGAGEMENT.test(d.title) && mentions(d.title, tokens)) ?? null

    out.push({
      key,
      label: labelOf(key, emails),
      emails,
      touches: sorted.length,
      hours: Math.round((minutes / 60) * 10) / 10,
      unbilledHours: Math.round((unbilledMinutes / 60) * 10) / 10,
      firstTouchAt: sorted[0].occurredAt,
      lastTouchAt: sorted[sorted.length - 1].occurredAt,
      lastInvoiceAt: lastInvoice?.occurredAt ?? null,
      lastInvoiceCents: lastInvoice?.amountCents ?? null,
      invoicedCents: mine.reduce((s, i) => s + i.amountCents, 0),
      engagement,
      isNew: Date.parse(sorted[0].occurredAt) >= weekAgo,
      recentIds: sorted.slice(-3).reverse().map((d) => d.id),
    })
  }
  return out.sort((a, b) => Date.parse(b.lastTouchAt) - Date.parse(a.lastTouchAt))
}

/** Chi sta assorbendo ore senza una fattura dietro. */
export function unbilled(matters: Matter[], now = new Date(), minHours = 3, minDays = 30): Matter[] {
  return matters
    .filter((m) => m.unbilledHours >= minHours)
    .filter((m) => !m.lastInvoiceAt || now.getTime() - Date.parse(m.lastInvoiceAt) >= minDays * 86_400_000)
    .sort((a, b) => b.unbilledHours - a.unbilledHours)
}

/** Clienti con cui si lavora, e nessuna lettera di incarico in memoria. */
export function withoutEngagement(matters: Matter[], minTouches = 3): Matter[] {
  return matters.filter((m) => !m.engagement && m.touches >= minTouches && !m.key.includes('@'))
}

/** I nomi nuovi: il momento del controllo dei conflitti. */
export function newContacts(matters: Matter[]): Matter[] {
  return matters.filter((m) => m.isNew)
}
