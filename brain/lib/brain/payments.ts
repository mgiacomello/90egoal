/**
 * Gli avvisi di pagamento nelle mail. Funzione pura: niente rete,
 * niente DOM, nessun import di valori.
 *
 * Il lavoro che costa non è pagare: è trovare l'IBAN dentro al PDF, la
 * causale giusta, il codice avviso di diciotto cifre. Qui si tirano
 * fuori, si controlla l'IBAN con il suo checksum (un IBAN copiato male
 * è un bonifico perso), e si prepara un "pacchetto" da copiare in banca
 * in un gesto.
 */

import { parseAmounts } from './reconcile.ts'

export type PaymentNotice = {
  kind: 'pagopa' | 'bonifico' | 'bollo'
  amountCents: number | null
  /** "2026-10-31" */
  dueDate: string | null
  iban: string | null
  beneficiary: string | null
  causale: string | null
  /** pagoPA: 18 cifre. */
  noticeCode: string | null
  /** pagoPA: codice fiscale dell'ente creditore, 11 cifre. */
  creditorCode: string | null
  /** Bollo auto: la targa. */
  plate: string | null
}

/** Il controllo mod-97 dell'IBAN. */
export function validIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  const moved = iban.slice(4) + iban.slice(0, 4)
  let rem = 0
  for (const ch of moved) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of v) rem = (rem * 10 + Number(digit)) % 97
  }
  return rem === 1
}

export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()
}

export function findIban(text: string): string | null {
  for (const m of text.matchAll(/\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?)\b/g)) {
    const candidate = m[1].replace(/\s+/g, '')
    if (validIban(candidate)) return candidate
  }
  return null
}

function near(text: string, label: RegExp, value: RegExp, span = 120): RegExpMatchArray | null {
  const at = text.search(label)
  if (at < 0) return null
  return text.slice(at, at + span).match(value)
}

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
}

function dueDateOf(text: string): string | null {
  const m = near(text, /(scadenza|scade|entro\s+il|da\s+pagare\s+entro|data\s+di\s+scadenza|due\s+date)/i, /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})|(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i)
  if (!m) return null
  const [d, mo, y] = m[1] ? [Number(m[1]), Number(m[2]), Number(m[3])] : [Number(m[4]), MONTHS[m[5].toLowerCase()], Number(m[6])]
  if (!d || !mo || !y) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function amountOf(text: string): number | null {
  const labelled = near(text, /(importo|totale|da\s+pagare|ammontare|amount\s+due|total)/i, /[\s\S]*/, 80)
  const pool = labelled ? parseAmounts(labelled[0]) : []
  if (pool.length) return pool[0]
  const all = parseAmounts(text)
  return all.length ? Math.max(...all) : null
}

/**
 * Un avviso di pagamento, se il testo lo è: pagoPA (codice avviso),
 * bollo auto (tassa automobilistica + targa), o un bonifico (IBAN
 * valido e un importo). Altrimenti null.
 */
export function parsePaymentNotice(text: string): PaymentNotice | null {
  const flat = text.replace(/ /g, ' ')
  const noticeCode = near(flat, /codice\s+avviso|numero\s+avviso|codice\s+iuv|avviso\s+di\s+pagamento/i, /\b([0-3]\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/, 160)?.[1]?.replace(/\s+/g, '') ?? null
  const creditorCode = near(flat, /(codice\s+fiscale\s+(?:dell')?ente|c\.?f\.?\s+ente|ente\s+creditore)/i, /\b(\d{11})\b/, 160)?.[1] ?? null
  const isBollo = /tassa\s+automobilistica|bollo\s+auto/i.test(flat)
  const plate = isBollo ? flat.match(/\b([A-Z]{2}\s?\d{3}\s?[A-Z]{2})\b/)?.[1]?.replace(/\s+/g, '') ?? null : null
  const iban = findIban(flat)
  const amountCents = amountOf(flat)

  if (!noticeCode && !isBollo && !(iban && amountCents)) return null

  const beneficiary =
    near(flat, /(beneficiario|intestat[oa]\s+a|a\s+favore\s+di|ragione\s+sociale)/i, /[:\s]+([A-Za-zÀ-ù0-9 .,'&-]{3,60})/, 90)?.[1]?.trim().replace(/[.,]$/, '') ?? null
  const causale = near(flat, /(causale|riferimento|descrizione\s+pagamento)/i, /[:\s]+([^\n]{3,140})/, 160)?.[1]?.trim() ?? null

  return {
    kind: noticeCode ? 'pagopa' : isBollo ? 'bollo' : 'bonifico',
    amountCents,
    dueDate: dueDateOf(flat),
    iban,
    beneficiary,
    causale,
    noticeCode,
    creditorCode,
    plate,
  }
}

function euros(cents: number): string {
  const e = Math.floor(cents / 100)
  return `€ ${String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(cents % 100).padStart(2, '0')}`
}

function itDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Il pacchetto da copiare in banca: un campo per riga, niente da cercare. */
export function paymentPack(n: PaymentNotice): string {
  const lines: string[] = []
  if (n.kind === 'pagopa' || (n.kind === 'bollo' && n.noticeCode)) {
    lines.push('*Pagamento pagoPA*')
    lines.push(`Codice avviso: ${n.noticeCode}`)
    if (n.creditorCode) lines.push(`Codice fiscale ente: ${n.creditorCode}`)
    lines.push('Si paga dall\'app della banca (sezione pagoPA / CBILL), da checkout.pagopa.it o in tabaccheria.')
  } else if (n.iban) {
    lines.push('*Bonifico*')
    if (n.beneficiary) lines.push(`Beneficiario: ${n.beneficiary}`)
    lines.push(`IBAN: ${formatIban(n.iban)}`)
  } else if (n.kind === 'bollo') {
    lines.push('*Bollo auto*')
    if (n.plate) lines.push(`Targa: ${n.plate}`)
    lines.push('Si paga con pagoPA dal sito della Regione o dall\'app della banca, indicando la targa.')
  }
  if (n.amountCents) lines.push(`Importo: ${euros(n.amountCents)}`)
  if (n.causale) lines.push(`Causale: ${n.causale}`)
  if (n.dueDate) lines.push(`Scadenza: ${itDay(n.dueDate)}`)
  return lines.join('\n')
}
