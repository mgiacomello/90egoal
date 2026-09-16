/**
 * Riconciliazione: quale fattura corrisponde a quale movimento.
 * Funzione pura: niente rete, niente DOM, nessun import di valori.
 *
 * Qui c'è una decisione di prodotto che vale la pena dichiarare, perché
 * va contro l'aria che tira: **questo agente non usa un modello.**
 *
 * Abbinare una fattura a un addebito è aritmetica — un importo, una
 * data, un nome — e l'aritmetica non si delega a qualcosa che potrebbe
 * anche solo occasionalmente leggere 1.250,00 come 1250,00 dollari o
 * confondere due fornitori con nomi simili. Un modello qui non
 * aggiungerebbe niente che il codice non faccia meglio, e porterebbe
 * latenza, costo e una classe di errori che in contabilità non ci si
 * può permettere.
 *
 * Il modello resta utile dove serve davvero giudizio. Sommare non è
 * giudizio.
 */

/** Gli importi si tengono in centesimi: i decimali in virgola mobile no. */
export type Money = number

/* ------------------------------------------------------------------ *
 * Importi
 * ------------------------------------------------------------------ */

/**
 * Da "1.250,00" o "1,250.00" a 125000 centesimi.
 *
 * Il punto dolente è che i due formati si scrivono con gli stessi
 * segni invertiti. Le regole, nell'ordine:
 *
 *  - se ci sono sia punti sia virgole, l'ultimo dei due è il decimale;
 *  - se c'è un separatore solo, seguito da una o due cifre in fondo, è
 *    un decimale ("1.25" → 1,25; "12,5" → 12,50);
 *  - se è seguito da tre cifre, è un separatore di migliaia
 *    ("1.250" → 1250, che in italiano è la lettura giusta);
 *  - altrimenti migliaia.
 */
export function parseAmount(raw: string): Money | null {
  const cleaned = raw.replace(/[^\d.,]/g, '')
  if (!/\d/.test(cleaned)) return null

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  let decimalSep = ''
  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? '.' : ','
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const pos = Math.max(lastDot, lastComma)
    const after = cleaned.length - pos - 1
    // Due separatori uguali ("1.250.000") sono per forza migliaia.
    const occurrences = cleaned.split(sep).length - 1
    decimalSep = occurrences === 1 && after >= 1 && after <= 2 ? sep : ''
  }

  const intPart = decimalSep
    ? cleaned.slice(0, cleaned.lastIndexOf(decimalSep)).replace(/[.,]/g, '')
    : cleaned.replace(/[.,]/g, '')
  const decPart = decimalSep ? cleaned.slice(cleaned.lastIndexOf(decimalSep) + 1) : ''

  if (!intPart && !decPart) return null
  const units = Number(intPart || '0')
  const cents = Number((decPart + '00').slice(0, 2))
  if (!Number.isFinite(units) || !Number.isFinite(cents)) return null

  return units * 100 + cents
}

/** Un segno di valuta abbastanza vicino da qualificare un numero nudo. */
const CURRENCY = /€|\$|\beur\b|\beuro\b|\busd\b|\bdollar/i

/**
 * Tutti gli importi plausibili dentro a un testo, in centesimi.
 *
 * La regex prende il numero **intero**, separatori compresi, e lascia
 * a `parseAmount` il compito di interpretarlo. Una versione precedente
 * provava a riconoscere il formato dentro alla regex stessa e su
 * "1250,00" si fermava dopo tre cifre, leggendo 125,00: l'errore
 * esatto che questo modulo esiste per impedire. La lezione è che il
 * formato va deciso in un posto solo.
 *
 * Un intero nudo diventa un importo solo se ha una valuta accanto,
 * altrimenti "Fattura n. 12 del 2026" produrrebbe due importi finti —
 * e uno di quelli potrebbe combaciare per caso con un movimento.
 */
export function parseAmounts(text: string): Money[] {
  const out = new Set<Money>()
  const re = /(?<![\d.,])\d[\d.,]*\d|(?<![\d.,])\d/g

  for (const m of text.matchAll(re)) {
    const raw = m[0]
    const value = parseAmount(raw)
    // Sotto un euro non è una fattura: è un numero d'ordine o una pagina.
    if (value === null || value < 100) continue

    if (!/[.,]/.test(raw)) {
      const at = m.index ?? 0
      const around = text.slice(Math.max(0, at - 12), at) + text.slice(at + raw.length, at + raw.length + 12)
      if (!CURRENCY.test(around)) continue
    }

    out.add(value)
  }
  return [...out]
}

/**
 * Da centesimi a "1.250,00", in formato italiano e senza `Intl`.
 *
 * Non è pignoleria: `toLocaleString('it-IT')` dipende dalla build ICU
 * di Node e su un runtime con ICU ridotto restituisce "1250,00" invece
 * di "1.250,00". Una funzione dichiarata pura che cambia risultato
 * secondo l'host non è pura, e qui il risultato finisce dentro a una
 * mail che chiede soldi a qualcuno.
 */
export function formatEuro(cents: Money): string {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const units = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const rest = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}${units},${rest}`
}

/** Da un istante ISO a "10/09/2026", in UTC e senza `Intl`, per lo stesso motivo. */
export function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

/* ------------------------------------------------------------------ *
 * Abbinamento
 * ------------------------------------------------------------------ */

export type TxLike = {
  id: string
  /** La controparte, come la scrive la banca. */
  label: string
  amountCents: Money
  occurredAt: string
  hasAttachment: boolean
}

export type DocLike = {
  id: string
  title: string
  text: string
  occurredAt: string
}

export type Confidence = 'certa' | 'probabile' | 'debole'

export type Candidate = {
  documentId: string
  title: string
  occurredAt: string
  confidence: Confidence
  score: number
  /** Le ragioni, in chiaro: chi guarda deve poter dire "sì, è questa". */
  why: string[]
}

/** Quanti giorni può stare lontana una fattura dal suo pagamento. */
const WINDOW_DAYS = 120

const NAME_STOPWORDS = new Set([
  'srl', 'srls', 'spa', 'sas', 'snc', 'sl', 'ltd', 'llc', 'inc', 'gmbh', 'bv', 'sa',
  'di', 'de', 'del', 'della', 'dei', 'e', 'and', 'the', 'societa', 'studio', 'group',
  'italia', 'italy', 'europe', 'com', 'www', 'srl.', 'spa.', 'fattura', 'invoice',
  'pagamento', 'bonifico', 'addebito', 'sepa', 'carta', 'pos',
])

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Le parole di un nome che lo identificano davvero. */
export function nameTokens(label: string): string[] {
  const out = new Set<string>()
  for (const token of fold(label).split(/[^a-z0-9]+/)) {
    if (token.length < 4) continue
    if (NAME_STOPWORDS.has(token)) continue
    out.add(token)
  }
  return [...out]
}

function daysBetween(a: string, b: string): number {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY
  return Math.abs(ta - tb) / 86_400_000
}

/**
 * Le fatture candidate per un movimento, dalla più convincente in giù.
 *
 * Tre segnali, e contano in quest'ordine: l'importo esatto, il nome
 * della controparte, la vicinanza nel tempo. L'importo da solo non
 * basta a dire "certa" — due fornitori possono aver emesso la stessa
 * cifra — ma senza importo non si è nemmeno candidati: è il vincolo
 * che tiene fuori il rumore.
 */
export function findInvoice(tx: TxLike, docs: DocLike[], now = new Date()): Candidate[] {
  const txTokens = nameTokens(tx.label)
  const candidates: Candidate[] = []

  for (const doc of docs) {
    const haystack = fold(`${doc.title}\n${doc.text}`)
    const why: string[] = []
    let score = 0

    const amountMatch = parseAmounts(doc.text).includes(tx.amountCents)
    if (!amountMatch) continue // senza l'importo non se ne parla
    why.push(`importo identico (€ ${formatEuro(tx.amountCents)})`)
    score += 3

    const shared = txTokens.filter((t) => haystack.includes(t))
    if (shared.length) {
      why.push(`controparte: ${shared.join(', ')}`)
      score += 2 + Math.min(shared.length - 1, 2) * 0.5
    }

    const gap = daysBetween(tx.occurredAt, doc.occurredAt)
    const inWindow = gap <= WINDOW_DAYS
    if (inWindow) {
      why.push(gap < 1 ? 'stesso giorno' : `${Math.round(gap)} giorni di distanza`)
      score += 2 - Math.min(gap / WINDOW_DAYS, 1)
    } else {
      why.push('data lontana')
    }

    const confidence: Confidence =
      shared.length && inWindow ? 'certa' : shared.length || inWindow ? 'probabile' : 'debole'

    candidates.push({
      documentId: doc.id,
      title: doc.title,
      occurredAt: doc.occurredAt,
      confidence,
      score,
      why,
    })
  }

  void now
  return candidates.sort((a, b) => b.score - a.score)
}

export type Reconciliation = {
  transaction: TxLike
  candidates: Candidate[]
}

/**
 * I movimenti senza giustificativo, con le fatture che potrebbero
 * esserlo. Un movimento che l'allegato ce l'ha già non è un problema
 * e non compare: un elenco di cose a posto non serve a nessuno.
 */
export function reconcile(
  transactions: TxLike[],
  docs: DocLike[],
  maxCandidates = 3
): Reconciliation[] {
  return transactions
    .filter((tx) => !tx.hasAttachment)
    .map((tx) => ({ transaction: tx, candidates: findInvoice(tx, docs).slice(0, maxCandidates) }))
    .sort((a, b) => {
      // Prima quelli senza nessun candidato: sono le fatture da chiedere.
      if (!a.candidates.length !== !b.candidates.length) return a.candidates.length ? 1 : -1
      return Date.parse(b.transaction.occurredAt) - Date.parse(a.transaction.occurredAt)
    })
}

/* ------------------------------------------------------------------ *
 * Il testo per chiedere la fattura
 * ------------------------------------------------------------------ */

/**
 * La mail da mandare a chi la fattura non l'ha mandata.
 *
 * Costruita dai dati del movimento, non generata: non c'è niente da
 * inventare, e un testo deterministico non può sbagliare l'importo o
 * la data che sta chiedendo.
 */
export function requestInvoiceText(tx: TxLike): string {
  const amount = formatEuro(tx.amountCents)
  const date = formatDay(tx.occurredAt)

  return [
    `Oggetto: Richiesta fattura — pagamento del ${date}`,
    '',
    'Buongiorno,',
    '',
    `risulta un pagamento di € ${amount} in data ${date} a favore di ${tx.label},`,
    'per il quale non abbiamo ancora ricevuto la relativa fattura.',
    '',
    'Vi chiediamo cortesemente di inviarcela, o di segnalarci se è già stata',
    'trasmessa e a quale indirizzo.',
    '',
    'Grazie,',
  ].join('\n')
}
