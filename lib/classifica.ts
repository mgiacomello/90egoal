// La logica della classifica: posizioni con i pari merito, movimento rispetto al turno
// prima, distacchi, chi mostrare. Funzioni pure, senza dipendenze: testate in scripts/game.test.ts.
import { nomeSchedina, ordinale, type Lingua } from './lingua.ts'

export interface RigaPunti {
  schedina_id: number
  user_id: string
  username: string
  full_name: string
  totale: number
}

export interface RigaGenerale {
  user_id: string
  username: string
  full_name: string
  totale: number
  pos: number
  giocate: number            // schedine con punteggio
  ultimo: number | null      // punti presi nell'ultimo turno (null se non l'ha giocato)
  movimento: number | null   // posizioni guadagnate (+) o perse (−) con l'ultimo turno; null = appena entrato
  vittorie: number           // giornate chiuse al primo posto (anche a pari merito)
}

// Ordina per punti e assegna le posizioni: a pari punti stessa posizione (10, 8, 8, 5 → 1°, 2°, 2°, 4°).
// A parità, ordine alfabetico: la lista non deve cambiare faccia a ogni ricarica.
export function conPosizioni<T extends { totale: number; username: string }>(righe: T[]): (T & { pos: number })[] {
  const ord = [...righe].sort((a, b) => b.totale - a.totale || a.username.localeCompare(b.username, 'it'))
  const out: (T & { pos: number })[] = []
  ord.forEach((r, i) => out.push({ ...r, pos: i > 0 && ord[i - 1].totale === r.totale ? out[i - 1].pos : i + 1 }))
  return out
}

function somma(righe: RigaPunti[]): Map<string, { user_id: string; username: string; full_name: string; totale: number; giocate: number }> {
  const m = new Map<string, { user_id: string; username: string; full_name: string; totale: number; giocate: number }>()
  for (const r of righe) {
    const e = m.get(r.user_id)
    if (e) { e.totale += r.totale; e.giocate++ }
    else m.set(r.user_id, { user_id: r.user_id, username: r.username, full_name: r.full_name, totale: r.totale, giocate: 1 })
  }
  return m
}

// Il turno più recente: le schedine con punteggio che partono a ridosso dell'ultima
// (Serie A, B e C dello stesso weekend sono un turno solo).
export function ultimoTurno(schedine: { id: number; deadline: string }[], conPunti: Set<number>, giorni = 4): Set<number> {
  const giocate = schedine.filter(s => conPunti.has(s.id))
  if (!giocate.length) return new Set()
  const ultima = Math.max(...giocate.map(s => Date.parse(s.deadline)))
  return new Set(giocate.filter(s => ultima - Date.parse(s.deadline) <= giorni * 86400000).map(s => s.id))
}

// La classifica generale: somma dei punti, posizioni, e per ognuno com'è andato l'ultimo turno.
export function classificaGenerale(righe: RigaPunti[], turno: Set<number>, concluse: Set<number> = new Set()): RigaGenerale[] {
  const prima = conPosizioni([...somma(righe.filter(r => !turno.has(r.schedina_id))).values()])
  const posPrima = new Map(prima.map(r => [r.user_id, r.pos]))
  const nelTurno = new Map<string, number>()
  for (const r of righe) if (turno.has(r.schedina_id)) nelTurno.set(r.user_id, (nelTurno.get(r.user_id) ?? 0) + r.totale)

  const vittorie = new Map<string, number>()
  const perSchedina = new Map<number, RigaPunti[]>()
  for (const r of righe) perSchedina.set(r.schedina_id, [...(perSchedina.get(r.schedina_id) ?? []), r])
  for (const [id, rr] of perSchedina) {
    if (!concluse.has(id)) continue
    const max = Math.max(...rr.map(r => r.totale))
    for (const r of rr) if (r.totale === max) vittorie.set(r.user_id, (vittorie.get(r.user_id) ?? 0) + 1)
  }

  return conPosizioni([...somma(righe).values()]).map(r => ({
    ...r,
    ultimo: nelTurno.has(r.user_id) ? nelTurno.get(r.user_id)! : null,
    // Senza un "prima" (primo turno in assoluto) non c'è movimento per nessuno.
    movimento: prima.length === 0 ? 0 : posPrima.has(r.user_id) ? posPrima.get(r.user_id)! - r.pos : null,
    vittorie: vittorie.get(r.user_id) ?? 0,
  }))
}

// Chi mostrare: i primi `cima`, e se il giocatore è più giù anche lui con chi gli sta
// subito sopra e subito sotto, così vede sempre dov'è e chi deve superare.
export function daMostrare<T extends { user_id: string }>(righe: T[], userId: string | undefined, cima = 10): { cima: T[]; vicino: T[] } {
  const primi = righe.slice(0, cima)
  const i = userId ? righe.findIndex(r => r.user_id === userId) : -1
  if (i < cima) return { cima: primi, vicino: [] }
  return { cima: primi, vicino: righe.slice(Math.max(cima, i - 1), i + 2) }
}

// La frase che dice al giocatore quanto manca: al gradino sopra, o quanto vantaggio ha in testa.
export function distacco(righe: { user_id: string; totale: number; pos: number }[], userId: string, lingua: Lingua = 'it'): string | null {
  const io = righe.find(r => r.user_id === userId)
  if (!io) return null
  const en = lingua === 'en'
  const pt = (n: number) => en ? `${n} ${n === 1 ? 'point' : 'points'}` : `${n} ${n === 1 ? 'punto' : 'punti'}`
  if (io.pos === 1) {
    const pari = righe.filter(r => r.pos === 1).length
    if (pari > 1) {
      if (en) return pari === 2 ? 'In the lead, tied with one other' : `In the lead, tied with ${pari - 1} others`
      return pari === 2 ? 'In testa a pari merito con un altro' : `In testa a pari merito con altri ${pari - 1}`
    }
    const secondo = righe.find(r => r.pos > 1)
    if (en) return secondo ? `In the lead by ${pt(io.totale - secondo.totale)}` : 'In the lead'
    return secondo ? `In testa con ${pt(io.totale - secondo.totale)} di vantaggio` : 'In testa'
  }
  const sopra = [...righe].reverse().find(r => r.pos < io.pos)!
  if (en) return `${pt(sopra.totale - io.totale)} off ${ordinale(sopra.pos)} place`
  return `A ${pt(sopra.totale - io.totale)} dal ${sopra.pos}° posto`
}

// "Serie A · 12ª giornata" → "A · 12ª" (o "12ª" dentro la vista di una serie sola). Gli altri nomi restano.
export function etichettaGiornata(nome: string, soloNumero = false, lingua: Lingua = 'it'): string {
  const m = /Serie\s+([ABC])\s*·\s*((\d+)ª)/.exec(nome)
  if (!m) return nomeSchedina(nome, lingua)
  // In inglese "12ª" diventa "MD 12" (matchday): l'ordinale italiano non si legge.
  const numero = lingua === 'en' ? `MD ${m[3]}` : m[2]
  return soloNumero ? numero : `${m[1]} · ${numero}`
}
