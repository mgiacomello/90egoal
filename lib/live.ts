// Motore della modalità live: l'admin inserisce i gol partita per partita,
// tutto il resto (minuti validi, recupero, prima e ultima squadra a segnare)
// si ricava da qui. Funzioni pure, senza dipendenze: testate in scripts/game.test.ts.

export type StatoPartita = 'da_giocare' | 'in_corso' | 'finita'

export interface GolLive {
  min: string   // "23'", "45+2'", "90+4'"
  team: string  // squadra che beneficia del gol (autogol compreso)
}

export interface PartitaLive {
  home: string
  away: string
  date: string
  ora?: string | null
}

export interface DettaglioLive {
  home: string
  away: string
  score: string
  minuti: string[]
  gol: GolLive[]
  stato?: StatoPartita
}

export interface Minuto {
  base: number
  extra: number
}

// "23", "23'", "45+2", "90 + 3'" → { base, extra }. Null se non è un minuto di gioco.
// Il recupero esiste solo a fine tempo: 45+, 90+ (e 105+, 120+ nei supplementari).
export function parseMinute(raw: string): Minuto | null {
  const s = String(raw).replace(/[’'′\s]/g, '')
  const m = /^(\d{1,3})(?:\+(\d{1,2}))?$/.exec(s)
  if (!m) return null
  const base = Number(m[1])
  const extra = m[2] ? Number(m[2]) : 0
  if (base < 1 || base > 120) return null
  if (m[2] !== undefined && (extra < 1 || ![45, 90, 105, 120].includes(base))) return null
  return { base, extra }
}

export function formatMinute({ base, extra }: Minuto): string {
  return extra ? `${base}+${extra}'` : `${base}'`
}

// Ordine dentro una partita: il 45+2 viene prima del 46.
function orderInMatch({ base, extra }: Minuto): number {
  const half = base <= 45 ? 1 : base <= 90 ? 2 : 3
  return half * 100000 + base * 100 + extra
}

// Minuti trascorsi dal calcio d'inizio, stimati: servono solo a mettere in fila
// i gol di partite diverse. Intervallo 15', recupero medio del primo tempo 2'.
function elapsed({ base, extra }: Minuto): number {
  if (base <= 45) return base + extra
  if (base <= 90) return base + extra + 17
  return base + extra + 27
}

function kickoffMs(p: PartitaLive): number {
  // Le partite di una schedina stanno nello stesso giorno: il fuso è lo stesso per
  // tutte, quindi per ordinarle basta trattare data e ora come se fossero UTC.
  const ora = p.ora && /^\d{1,2}:\d{2}$/.test(p.ora) ? p.ora.padStart(5, '0') : '00:00'
  const ms = Date.parse(`${p.date}T${ora}:00Z`)
  return Number.isNaN(ms) ? 0 : ms
}

export function matchKey(p: { home: string; away: string }): string {
  return `${p.home}__${p.away}`
}

// Ricostruisce il dettaglio di una partita dai suoi gol: punteggio, minuti in ordine.
export function buildDettaglio(p: PartitaLive, gol: GolLive[], stato: StatoPartita): DettaglioLive {
  const validi = gol
    .map(g => ({ g, m: parseMinute(g.min) }))
    .filter((x): x is { g: GolLive; m: Minuto } => x.m !== null && (x.g.team === p.home || x.g.team === p.away))
    .sort((a, b) => orderInMatch(a.m) - orderInMatch(b.m))
  const golOrdinati = validi.map(({ g, m }) => ({ min: formatMinute(m), team: g.team }))
  const h = golOrdinati.filter(g => g.team === p.home).length
  const a = golOrdinati.filter(g => g.team === p.away).length
  return {
    home: p.home,
    away: p.away,
    score: `${h}-${a}`,
    minuti: golOrdinati.map(g => g.min),
    gol: golOrdinati,
    stato,
  }
}

export interface RisultatoDerivato {
  minuti_gol: number[]
  recupero: 'primo' | 'secondo' | 'entrambi' | 'nessuno'
  first_goal_team: string | null
  last_goal_team: string | null
  finite: number
  inCorso: number
  completa: boolean
}

// Dal dettaglio di tutte le partite al risultato della schedina, con le regole del gioco:
// - valgono per i minuti solo i gol dall'1' al 90' (recupero e supplementari esclusi);
// - più gol nello stesso minuto contano una volta sola;
// - il recupero conta per il bonus, primo tempo (45+) o secondo (90+);
// - prima e ultima squadra: in ordine di orario reale fra tutte le partite.
export function deriveRisultato(partite: PartitaLive[], dettagli: DettaglioLive[]): RisultatoDerivato {
  const byKey = new Map(dettagli.map(d => [matchKey(d), d]))
  const minuti = new Set<number>()
  let rec1 = false
  let rec2 = false
  const cronologia: { at: number; seq: number; team: string }[] = []
  let seq = 0
  let finite = 0
  let inCorso = 0

  for (const p of partite) {
    const d = byKey.get(matchKey(p))
    if (!d) continue
    if (d.stato === 'finita') finite++
    else if (d.stato === 'in_corso') inCorso++
    const k0 = kickoffMs(p)
    for (const g of d.gol ?? []) {
      const m = parseMinute(g.min)
      if (!m) continue
      if (m.extra === 0 && m.base >= 1 && m.base <= 90) minuti.add(m.base)
      if (m.extra > 0 && m.base === 45) rec1 = true
      if (m.extra > 0 && m.base === 90) rec2 = true
      cronologia.push({ at: k0 + elapsed(m) * 60000, seq: seq++, team: g.team })
    }
  }

  cronologia.sort((a, b) => a.at - b.at || a.seq - b.seq)
  return {
    minuti_gol: [...minuti].sort((a, b) => a - b),
    recupero: rec1 && rec2 ? 'entrambi' : rec1 ? 'primo' : rec2 ? 'secondo' : 'nessuno',
    first_goal_team: cronologia[0]?.team ?? null,
    last_goal_team: cronologia[cronologia.length - 1]?.team ?? null,
    finite,
    inCorso,
    completa: partite.length > 0 && finite === partite.length,
  }
}
