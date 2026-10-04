/**
 * Il board. Funzione pura: niente rete, niente DOM, nessun import di
 * valori.
 *
 * Cinque dirigenti leggono gli stessi fatti con mandati diversi, e il
 * valore sta nel disaccordo: Sterling che frena su una spesa che
 * Harper vuole fare, Archer che chiede a Grace di liberare un
 * pomeriggio. Qui ci sono le forme — memo, replica, sintesi — e le
 * regole che le tengono oneste: ogni riga cita, un memo è una fonte
 * citabile come un documento, e un'obiezione non sparisce nella
 * sintesi: resta scritta come "aperto".
 */

export type Stance = 'accordo' | 'obiezione' | 'risposta' | 'richiesta'

export type BoardSource = {
  handle: string
  source: string
  title: string
  occurredAt: string
  url: string | null
}

export type BoardClaim = {
  text: string
  sources: BoardSource[]
  unverified?: string[]
}

export type Memo = {
  executive: string
  punti: BoardClaim[]
  /** "Sterling chiede a Grace: …" */
  richieste: { a: string; text: string; sources: BoardSource[] }[]
  model: string
  dropped: number
}

export type Reply = {
  from: string
  to: string
  stance: Stance
  text: string
  sources: BoardSource[]
}

export type Synthesis = {
  decisioni: BoardClaim[]
  /** I disaccordi, lasciati aperti e firmati. */
  aperti: BoardClaim[]
  perTe: BoardClaim[]
  model: string
  dropped: number
}

export type Board = {
  generatedAt: string
  memos: Memo[]
  replies: Reply[]
  synthesis: Synthesis | null
}

/** Il testo di un memo come fonte per gli altri: righe numerate, richieste in coda. */
export function memoExcerpt(memo: Memo, nameOf: (key: string) => string): string {
  const lines = memo.punti.map((p, i) => `${i + 1}. ${p.text}`)
  for (const r of memo.richieste) lines.push(`Richiesta a ${nameOf(r.a)}: ${r.text}`)
  return lines.join('\n') || '(nessun punto)'
}

/** Le repliche in cui qualcuno si è opposto a qualcuno: sono le righe da non perdere. */
export function objections(replies: Reply[]): Reply[] {
  return replies.filter((r) => r.stance === 'obiezione')
}

/** Le repliche ricevute da un dirigente, dalle obiezioni in giù. */
export function repliesTo(replies: Reply[], executive: string): Reply[] {
  const weight: Record<Stance, number> = { obiezione: 0, richiesta: 1, risposta: 2, accordo: 3 }
  return replies.filter((r) => r.to === executive).sort((a, b) => weight[a.stance] - weight[b.stance])
}

/** Le coppie che si sono parlate: per disegnare il tavolo. */
export function threads(replies: Reply[]): { from: string; to: string; count: number }[] {
  const map = new Map<string, number>()
  for (const r of replies) map.set(`${r.from}|${r.to}`, (map.get(`${r.from}|${r.to}`) ?? 0) + 1)
  return [...map.entries()].map(([k, count]) => {
    const [from, to] = k.split('|')
    return { from, to, count }
  })
}

/** Il board vale una mail se ha deciso qualcosa, se qualcuno si è opposto, o se c'è una mossa per il titolare. */
export function isBoardWorthSending(board: Board): boolean {
  if (!board.synthesis) return false
  return board.synthesis.decisioni.length > 0 || board.synthesis.aperti.length > 0 || board.synthesis.perTe.length > 0
}

/** Il board in testo semplice, per la mail e per il registro. */
export function renderBoardText(board: Board, nameOf: (key: string) => string): string {
  const out: string[] = []
  if (board.synthesis) {
    if (board.synthesis.decisioni.length) out.push('IL BOARD HA DECISO', ...board.synthesis.decisioni.map((c) => `- ${c.text}`), '')
    if (board.synthesis.aperti.length) out.push('RESTA APERTO', ...board.synthesis.aperti.map((c) => `- ${c.text}`), '')
    if (board.synthesis.perTe.length) out.push('PER TE', ...board.synthesis.perTe.map((c) => `- ${c.text}`), '')
  }
  for (const memo of board.memos) {
    if (!memo.punti.length && !memo.richieste.length) continue
    out.push(nameOf(memo.executive).toUpperCase(), ...memo.punti.map((p) => `- ${p.text}`))
    for (const r of memo.richieste) out.push(`- → ${nameOf(r.a)}: ${r.text}`)
    out.push('')
  }
  const obj = objections(board.replies)
  if (obj.length) out.push('OBIEZIONI', ...obj.map((r) => `- ${nameOf(r.from)} a ${nameOf(r.to)}: ${r.text}`), '')
  return out.join('\n').trim()
}
