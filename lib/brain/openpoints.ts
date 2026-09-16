/**
 * I punti aperti. Funzione pura: niente rete, niente DOM, nessun
 * import di valori.
 *
 * Un punto aperto è un impegno preso o una domanda ricevuta che non è
 * ancora stata chiusa. Nel post che ha ispirato questo prodotto è la
 * riga più preziosa di tutte — *"i punti aperti si trascinano finché
 * non li chiudo io"* — ed è anche quella che nessun assistente
 * rispetta, perché ricordarsene costa uno stato e dimenticarsene no.
 *
 * Qui la regola è letterale: **un punto si chiude solo a mano.** Il
 * brief di domani non lo lascia cadere perché nessuno l'ha più
 * nominato; se non se ne parla, il punto resta e invecchia — ed è
 * proprio l'invecchiare che lo rende una cosa da guardare.
 *
 * Il problema tecnico è che lo stesso punto, riformulato da un modello
 * il giorno dopo, è una stringa diversa. Senza un riconoscimento
 * tollerante la lista si riempirebbe di doppioni e diventerebbe
 * inguardabile in una settimana. Da qui l'impronta a sacco di parole
 * più il confronto di somiglianza.
 */

export type OpenPointLike = {
  id: string
  text: string
  fingerprint: string
  openedAt: string
  lastSeenAt: string
}

/** Parole che non distinguono un impegno da un altro. */
const NOISE = new Set([
  'a', 'ad', 'ai', 'al', 'alla', 'alle', 'allo', 'anche', 'che', 'chi', 'ci', 'con',
  'da', 'dai', 'dal', 'dalla', 'dei', 'del', 'della', 'delle', 'di', 'e', 'ed', 'gli',
  'ha', 'hanno', 'ho', 'i', 'il', 'in', 'la', 'le', 'lo', 'ma', 'mi', 'ne', 'nel',
  'nella', 'non', 'o', 'per', 'più', 'piu', 'si', 'su', 'sul', 'sulla', 'un', 'una',
  'uno', 'va', 'ancora', 'poi', 'quando', 'come', 'cosa', 'essere', 'stato', 'stata',
  'and', 'for', 'from', 'the', 'to', 'with', 'is', 'are', 'of', 'on', 'it',
])

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Le parole che identificano un punto, senza rumore e senza doppioni. */
export function significantTokens(text: string): string[] {
  const out = new Set<string>()
  for (const token of fold(text).split(/[^a-z0-9@.]+/)) {
    const clean = token.replace(/^\.+|\.+$/g, '')
    if (clean.length < 3) continue
    if (NOISE.has(clean)) continue
    out.add(clean)
  }
  return [...out]
}

/**
 * L'impronta di un punto: le parole che contano, in ordine alfabetico.
 *
 * L'ordinamento è voluto. "Chiedere la fattura a Rossi" e "a Rossi,
 * chiedere la fattura" sono lo stesso impegno scritto in due ordini, e
 * devono avere la stessa impronta — così il doppione identico lo ferma
 * già il vincolo di unicità del database, senza arrivare al confronto.
 */
export function fingerprint(text: string): string {
  return significantTokens(text).sort().join('-')
}

/** Quanto due punti si somigliano, da 0 a 1 (Jaccard sui token). */
export function similarity(a: string, b: string): number {
  const ta = new Set(significantTokens(a))
  const tb = new Set(significantTokens(b))
  if (!ta.size || !tb.size) return 0

  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / (ta.size + tb.size - shared)
}

/** Sopra questa somiglianza è lo stesso punto, riformulato. */
export const SAME_POINT = 0.6

/**
 * Il punto già aperto che questo testo sta ridicendo, se c'è.
 * Fra più candidati vince il più somigliante, non il primo trovato.
 */
export function matchExisting(text: string, existing: OpenPointLike[]): OpenPointLike | null {
  const print = fingerprint(text)
  let best: OpenPointLike | null = null
  let bestScore = SAME_POINT

  for (const point of existing) {
    if (point.fingerprint === print) return point
    const score = similarity(text, point.text)
    if (score >= bestScore) {
      best = point
      bestScore = score
    }
  }
  return best
}

export type Staleness = 'nuovo' | 'in attesa' | 'fermo'

export function ageInDays(openedAt: string, now: Date): number {
  const then = Date.parse(openedAt)
  if (!Number.isFinite(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000))
}

/**
 * Da quanto è lì.
 *
 * Serve a rendere visibile la cosa che conta: non *quanti* punti hai
 * aperti, ma da quanto tempo ce l'hai. Uno di ieri è normale, uno di
 * tre settimane è una decisione che stai rimandando.
 */
export function staleness(openedAt: string, now: Date): Staleness {
  const age = ageInDays(openedAt, now)
  if (age < 3) return 'nuovo'
  if (age < 14) return 'in attesa'
  return 'fermo'
}

/** I più vecchi in cima: sono quelli che stai evitando. */
export function sortByAge<T extends { openedAt: string }>(points: T[]): T[] {
  return [...points].sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt))
}

export type PointDecision =
  | { action: 'keep'; id: string; text: string }
  | { action: 'open'; text: string; fingerprint: string }

/**
 * Cosa fare dei punti che il brief di oggi ha tirato fuori.
 *
 * Nessuna chiusura automatica, mai: questa funzione sa solo aprire
 * punti nuovi e riconoscere quelli che già ci sono. Chiudere è un
 * gesto dell'utente, ed è l'intero motivo per cui la lista è credibile.
 */
export function decidePoints(texts: string[], existing: OpenPointLike[]): PointDecision[] {
  const decisions: PointDecision[] = []
  // I punti aperti in questo stesso giro contano come esistenti: due
  // frasi simili nello stesso brief non devono diventare due righe.
  const pool = [...existing]

  for (const raw of texts) {
    const text = raw.trim()
    if (!text) continue

    const found = matchExisting(text, pool)
    if (found) {
      decisions.push({ action: 'keep', id: found.id, text: found.text })
      continue
    }

    const print = fingerprint(text)
    if (!print) continue
    decisions.push({ action: 'open', text, fingerprint: print })
    pool.push({ id: '', text, fingerprint: print, openedAt: '', lastSeenAt: '' })
  }

  return decisions
}
