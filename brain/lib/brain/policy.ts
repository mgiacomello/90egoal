/**
 * La politica d'azione. Funzione pura: niente rete, niente DOM, nessun
 * import di valori.
 *
 * Da qui BRAIN non solo legge: agisce. E un assistente in carne e ossa
 * che agisce per te ha delle regole che non si discutono — non paga
 * senza chiedere, non scrive a nome tuo senza che tu l'abbia visto, non
 * inserisce i dati della tua carta da nessuna parte. Queste regole
 * stanno qui, nel codice, e l'esecutore le applica **prima** di ogni
 * gesto: il modello può chiedere quello che vuole, ma il clic su
 * "Paga" senza un'approvazione con l'importo giusto non parte.
 */

export type ActionKind =
  | 'browse' // leggere una pagina
  | 'form' // compilare e inviare un modulo senza pagamento (check-in, iscrizione)
  | 'signup' // iscriversi a una newsletter con la mail del titolare
  | 'send_email' // mandare una mail a nome del titolare
  | 'rsvp' // rispondere a un invito in agenda
  | 'payment' // il clic che fa uscire soldi
  | 'domain' // agire su un sito nuovo

export type ApprovalKind = 'payment' | 'send_email' | 'rsvp' | 'domain' | 'plan'

export type Approval = {
  /** Quattro caratteri, da citare se ce n'è più d'una in attesa: "ok 7F2A". */
  code: string
  kind: ApprovalKind
  summary: string
  amountCents?: number | null
  payee?: string | null
  /** ISO */
  requestedAt: string
  expiresAt: string
  grantedAt?: string | null
}

/** Quanto vale un'approvazione prima di scadere. Un pagamento dura poco: i prezzi cambiano. */
export const APPROVAL_TTL_MINUTES: Record<ApprovalKind, number> = {
  payment: 60,
  send_email: 24 * 60,
  rsvp: 24 * 60,
  domain: 24 * 60,
  plan: 24 * 60,
}

/** Che cosa chiede un'approvazione, e che cosa no. */
export function requiresApproval(kind: ActionKind, options: { autoCheckin?: boolean; allowNewsletter?: boolean; isCheckin?: boolean } = {}): boolean {
  switch (kind) {
    case 'browse':
      return false
    case 'form':
      // Il check-in online è gratuito e il titolare può dire "no" quando
      // BRAIN glielo annuncia: è l'esempio canonico di un compito delegato.
      return !(options.isCheckin && options.autoCheckin !== false)
    case 'signup':
      return options.allowNewsletter === false
    default:
      return true
  }
}

/** Sopra questa cifra BRAIN non paga mai: prepara tutto, il clic è tuo. */
export function payCapCents(env: Record<string, string | undefined> = {}): number {
  const raw = Number(env.BRAIN_PAY_CAP_EUR ?? 300)
  return Math.round((Number.isFinite(raw) && raw >= 0 ? raw : 300) * 100)
}

export function withinCap(amountCents: number, capCents: number): boolean {
  return amountCents > 0 && amountCents <= capCents
}

/** Il codice di un'approvazione: dall'id del mandato, maiuscolo, senza ambiguità visive. */
export function approvalCode(id: string, salt = 0): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let h = 2166136261 ^ salt
  for (const ch of id) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619) >>> 0
  }
  const digits = '23456789'
  let out = ''
  for (let i = 0; i < 4; i += 1) {
    // La terza posizione è sempre una cifra: così un codice non si confonde con una parola.
    out += i === 2 ? digits[h % digits.length] : alphabet[h % alphabet.length]
    h = Math.floor(h / alphabet.length) + (i + 1) * 7919
  }
  return out
}

export function newApproval(
  id: string,
  kind: ApprovalKind,
  summary: string,
  now: Date,
  extra: { amountCents?: number | null; payee?: string | null; salt?: number } = {}
): Approval {
  return {
    code: approvalCode(id, extra.salt ?? 0),
    kind,
    summary,
    amountCents: extra.amountCents ?? null,
    payee: extra.payee ?? null,
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + APPROVAL_TTL_MINUTES[kind] * 60_000).toISOString(),
    grantedAt: null,
  }
}

export function isExpired(a: Approval, now: Date): boolean {
  return Date.parse(a.expiresAt) <= now.getTime()
}

/* ------------------------------------------------------------------ *
 * Le risposte del titolare
 * ------------------------------------------------------------------ */

// `\b` non vede la ì come lettera: la fine della parola si controlla a mano.
const END = '(?=$|[\\s,.;:!?])'
const YES = new RegExp(`^(ok|okay|sì|si|yes|vai|procedi|confermo|conferma|va bene|d'accordo|fallo|paga|manda|invia|accetto)${END}`, 'i')
const NO = new RegExp(`^(no|annulla|stop|ferma|aspetta|non (?:farlo|ancora|mandare|pagare)|lascia stare|rifiuta)${END}`, 'i')
/** Un codice ha sempre una cifra: "BENE" non è un codice. */
const CODE = /\b(?=[A-Z2-9]*\d)([A-HJ-NP-Z2-9]{4})\b/

export type Decision = { decision: 'yes' | 'no'; code: string | null }

/** "ok", "sì vai", "ok 7F2A", "no" → una decisione; altrimenti null. */
export function parseDecision(text: string): Decision | null {
  const t = text.trim().replace(/[.!]+$/, '')
  const yes = YES.test(t)
  const no = NO.test(t)
  if (!yes && !no) return null
  const code = t.toUpperCase().match(CODE)?.[1] ?? null
  return { decision: no ? 'no' : 'yes', code }
}

export type Pending = { taskId: string; approval: Approval }

/**
 * A quale richiesta si riferisce la risposta. Con il codice, a quella;
 * senza, solo se ce n'è **una sola** non scaduta — altrimenti si chiede
 * quale, perché un "ok" detto alla richiesta sbagliata è un pagamento
 * sbagliato.
 */
export function matchPending(decision: Decision, pending: Pending[], now: Date): { match: Pending | null; ambiguous: boolean } {
  const live = pending.filter((p) => !isExpired(p.approval, now) && !p.approval.grantedAt)
  if (decision.code) {
    const found = live.find((p) => p.approval.code === decision.code) ?? null
    return { match: found, ambiguous: false }
  }
  if (live.length === 1) return { match: live[0], ambiguous: false }
  return { match: null, ambiguous: live.length > 1 }
}

/* ------------------------------------------------------------------ *
 * Le guardie del browser
 * ------------------------------------------------------------------ */

const PAY_LABEL =
  /\b(paga(?:\s+ora|\s+adesso)?|pay(?:\s+now)?|acquista(?:\s+ora)?|compra(?:\s+ora)?|buy(?:\s+now)?|place\s+order|complete\s+(?:purchase|order)|conferma\s+(?:e\s+paga|ordine|l'ordine|il\s+pagamento|pagamento|acquisto)|confirm\s+(?:and\s+pay|order|payment|purchase)|procedi\s+al\s+pagamento|submit\s+payment|effettua\s+(?:il\s+)?pagamento|ordina\s+e\s+paga)\b/i

/** Questo bottone fa uscire soldi? */
export function isPaymentAction(label: string): boolean {
  return PAY_LABEL.test(label.replace(/\s+/g, ' '))
}

const CARD = /(cc-?number|card-?number|cardnumber|numero\s*(?:di\s*)?carta|pan\b|cc-?csc|cvc|cvv|security\s*code|codice\s*di\s*sicurezza|cc-?exp|expir|scadenza\s*carta|iban)/i

/** Un campo in cui BRAIN non scrive mai: i dati della carta e del conto non passano da qui. */
export function isSensitiveField(descriptor: string): boolean {
  return CARD.test(descriptor)
}

/** L'importo approvato è quello che la pagina mostra? "112,45", "112.45", "€112" contano tutti. */
export function amountVisible(pageText: string, amountCents: number): boolean {
  const euros = Math.floor(amountCents / 100)
  const cents = String(amountCents % 100).padStart(2, '0')
  const thousands = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const thousandsEn = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const variants = [`${euros},${cents}`, `${euros}.${cents}`, `${thousands},${cents}`, `${thousandsEn}.${cents}`]
  if (cents === '00') variants.push(`€${euros}`, `€ ${euros}`, `${euros} €`, `${euros}€`, `EUR ${euros}`)
  const text = pageText.replace(/ /g, ' ')
  return variants.some((v) => new RegExp(`(?<![\\d.,])${v.replace(/[.$]/g, '\\$&')}(?![\\d])`).test(text))
}

/** "https://www.ryanair.com/it/it" → "ryanair.com". */
export function registrableDomain(url: string): string | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const twoLevel = new Set(['co.uk', 'com.au', 'co.jp', 'com.br', 'gov.it', 'gov.uk', 'ac.uk', 'org.uk'])
  const last2 = parts.slice(-2).join('.')
  return twoLevel.has(last2) ? parts.slice(-3).join('.') : last2
}

/** I domini dei fornitori di pagamento: un checkout ci passa, e non è un sito nuovo. */
export const PAYMENT_DOMAINS = [
  'stripe.com', 'adyen.com', 'paypal.com', 'checkout.com', 'klarna.com', 'satispay.com', 'nexi.it', 'xpay.nexigroup.com',
  'pagopa.gov.it', 'pagopa.it', 'worldpay.com', 'braintreegateway.com', 'shopify.com', 'shop.app',
]

/** Si può agire (cliccare, scrivere) su questa pagina? Leggere si può ovunque. */
export function canActOn(url: string, allowed: string[]): boolean {
  const d = registrableDomain(url)
  if (!d) return false
  return [...allowed, ...PAYMENT_DOMAINS].some((a) => d === a || d.endsWith(`.${a}`))
}
