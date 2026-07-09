import { Risultato, MatchDetail } from '@/lib/types'

export interface GoalBand {
  label: string
  count: number
  pct: number
}

export interface GoalStats {
  matches: number
  totalGoals: number
  avgPerMatch: number
  bands: GoalBand[]         // fasce di minuti regolari (6 × 15')
  hottest: GoalBand | null  // fascia più calda
  recupero1: number         // gol nel recupero 1° tempo
  recupero2: number         // gol nel recupero 2° tempo
  recuperoPct: number       // % gol nel recupero sul totale
  topMinutes: { m: number; count: number }[]
}

const BANDS: [number, number, string][] = [
  [1, 15, "1-15'"],
  [16, 30, "16-30'"],
  [31, 45, "31-45'"],
  [46, 60, "46-60'"],
  [61, 75, "61-75'"],
  [76, 90, "76-90'"],
]

// Calcola la distribuzione dei gol dai risultati (tutte le partite giocate del torneo).
// I minuti nei dettagli sono stringhe: "39'", "45+3'" (recupero 1°T), "90+2'" (recupero 2°T).
export function computeGoalStats(risultati: Risultato[]): GoalStats {
  const bandCounts = new Array(BANDS.length).fill(0)
  const minuteCounts = new Map<number, number>()
  let rec1 = 0, rec2 = 0, total = 0, matches = 0

  for (const r of risultati) {
    const dett = (r.dettagli as MatchDetail[] | undefined) ?? []
    for (const d of dett) {
      matches++
      for (const raw of d.minuti) {
        const s = String(raw).replace(/['\s]/g, '')
        if (s.includes('+')) {
          total++
          const base = parseInt(s.split('+')[0], 10)
          if (base <= 45) rec1++; else rec2++
          continue // il recupero non è un minuto pronosticabile (bonus a parte)
        }
        const m = parseInt(s, 10)
        if (isNaN(m) || m < 1 || m > 90) continue
        total++
        minuteCounts.set(m, (minuteCounts.get(m) ?? 0) + 1)
        const bi = BANDS.findIndex(([a, b]) => m >= a && m <= b)
        if (bi >= 0) bandCounts[bi]++
      }
    }
  }

  const regularTotal = bandCounts.reduce((a: number, b: number) => a + b, 0) || 1
  const bands: GoalBand[] = BANDS.map(([, , label], i) => ({
    label,
    count: bandCounts[i],
    pct: Math.round((bandCounts[i] / regularTotal) * 100),
  }))
  const hottest = bands.reduce<GoalBand | null>((best, b) => (!best || b.count > best.count ? b : best), null)
  const topMinutes = [...minuteCounts.entries()]
    .map(([m, count]) => ({ m, count }))
    .sort((a, b) => b.count - a.count || a.m - b.m)
    .slice(0, 6)

  return {
    matches,
    totalGoals: total,
    avgPerMatch: matches ? Math.round((total / matches) * 10) / 10 : 0,
    bands,
    hottest: hottest && hottest.count > 0 ? hottest : null,
    recupero1: rec1,
    recupero2: rec2,
    recuperoPct: total ? Math.round(((rec1 + rec2) / total) * 100) : 0,
    topMinutes,
  }
}
