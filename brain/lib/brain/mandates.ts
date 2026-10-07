/**
 * I comandi del titolare. Funzione pura: niente rete, niente DOM,
 * nessun import di valori.
 *
 * Su WhatsApp o per mail il titolare scrive come scriverebbe a un
 * assistente: "comprami le On Cloud 6 taglia 43", "ricordami domani
 * alle 9 di chiamare Verdi", "paga il bollo". Qui si capisce **che
 * tipo di incarico è** — le parole d'ordine sono poche e note — e,
 * per i promemoria, **quando**. Il resto è una domanda, e va al board.
 */

export type Command =
  | { kind: 'buy'; goal: string }
  | { kind: 'pay'; goal: string }
  | { kind: 'checkin'; goal: string }
  | { kind: 'errand'; goal: string }
  | { kind: 'remind'; what: string; atIso: string }
  | { kind: 'tasks' }

const WEEKDAYS: Record<string, number> = { domenica: 0, lunedì: 1, lunedi: 1, martedì: 2, martedi: 2, mercoledì: 3, mercoledi: 3, giovedì: 4, giovedi: 4, venerdì: 5, venerdi: 5, sabato: 6 }

function romeOffset(month: number): number {
  return month >= 4 && month <= 10 ? 2 : 1
}

/** Un'ora italiana di un giorno UTC dato come "YYYY-MM-DD". */
function at(day: string, h: number, m: number): string {
  const [y, mo, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h - romeOffset(mo), m)).toISOString()
}

function romeDay(now: Date, plusDays = 0): string {
  const shifted = new Date(now.getTime() + romeOffset(now.getUTCMonth() + 1) * 3_600_000 + plusDays * 86_400_000)
  return shifted.toISOString().slice(0, 10)
}

/**
 * Quando, da una frase: "fra 2 ore", "tra 30 minuti", "domani alle 9",
 * "dopodomani", "venerdì alle 15:30", "il 12/10 alle 18", "alle 17".
 * Senza orario: le 9 del mattino. Restituisce anche il resto della
 * frase, ripulito dall'indicazione di tempo.
 */
export function parseWhen(text: string, now: Date): { atIso: string; rest: string } | null {
  let rest = text
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = rest.match(re)
    if (m) rest = rest.replace(m[0], ' ')
    return m
  }

  const rel = take(/\b(?:fra|tra)\s+(\d+|un|una|mezz'?ora)\s*(minut[oi]|or[ae]|giorn[oi])?\b/i)
  if (rel) {
    const n = /mezz/i.test(rel[1]) ? 30 : /^un/i.test(rel[1]) ? 1 : Number(rel[1])
    const unit = /mezz/i.test(rel[1]) ? 'm' : (rel[2] ?? 'ore').toLowerCase()[0]
    const ms = unit === 'm' ? n * 60_000 : unit === 'g' ? n * 86_400_000 : n * 3_600_000
    return { atIso: new Date(now.getTime() + ms).toISOString(), rest: rest.replace(/\s+/g, ' ').trim() }
  }

  let day: string | null = null
  if (take(/\bdopodomani\b/i)) day = romeDay(now, 2)
  else if (take(/\bdomani\b/i)) day = romeDay(now, 1)
  else if (take(/\boggi\b|\bstasera\b/i)) day = romeDay(now, 0)
  const dm = take(/\b(?:il\s+)?(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/)
  if (dm) {
    const y = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : Number(romeDay(now).slice(0, 4))
    day = `${y}-${String(Number(dm[2])).padStart(2, '0')}-${String(Number(dm[1])).padStart(2, '0')}`
  }
  // `\b` non vede la ì come lettera: la fine della parola si controlla a mano.
  const wd = take(/\b(domenica|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato)(?=$|[\s,.;:!?])/i)
  if (wd && !day) {
    const target = WEEKDAYS[wd[1].toLowerCase()]
    const today = new Date(`${romeDay(now)}T12:00:00Z`).getUTCDay()
    const diff = ((target - today + 7) % 7) || 7
    day = romeDay(now, diff)
  }

  const hm = take(/\b(?:alle|ore|h)\s*(\d{1,2})(?:[:.](\d{2}))?\b/i)
  if (!day && !hm) return null
  const h = hm ? Number(hm[1]) : 9
  const m = hm?.[2] ? Number(hm[2]) : 0
  if (h > 23 || m > 59) return null
  let iso = at(day ?? romeDay(now), h, m)
  // "alle 9" detto alle 10: è domani.
  if (!day && Date.parse(iso) <= now.getTime()) iso = at(romeDay(now, 1), h, m)
  return { atIso: iso, rest: rest.replace(/\s+/g, ' ').trim() }
}

/** Che incarico è, se lo è. */
export function parseCommand(text: string, now: Date): Command | null {
  const t = text.trim()
  if (/^(mandati|incarichi|cosa stai facendo|a che punto sei)\??$/i.test(t)) return { kind: 'tasks' }
  if (/^(comprami|compra|acquista|ordina|prendimi)\b/i.test(t)) return { kind: 'buy', goal: t }
  if (/^(pagami|paga|salda)\b/i.test(t)) return { kind: 'pay', goal: t }
  if (/^(fai(?:mi)?\s+(?:il\s+)?check.?in|check.?in)\b/i.test(t)) return { kind: 'checkin', goal: t }
  if (/^(prenota(?:mi)?|disdici|annulla\s+(?:l'|il\s+)?abbonamento|iscrivimi|vai\s+su|cerca\s+e|trova\s+e|scarica(?:mi)?|richiedi)\b/i.test(t)) return { kind: 'errand', goal: t }
  const r = t.match(/^(ricordami|ricorda(?:mi)?|promemoria)[:,]?\s+([\s\S]+)$/i)
  if (r) {
    const when = parseWhen(r[2], now)
    if (!when) return null
    const what = when.rest.replace(/^(di|che)\s+/i, '').trim()
    return { kind: 'remind', what: what || r[2], atIso: when.atIso }
  }
  return null
}
