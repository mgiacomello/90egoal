// Squadre, nomi e incolla-elenco. Funzioni pure, senza dipendenze: testate in scripts/game.test.ts.

// "Schedina 1 — Mondiali FIFA 2026" → "Schedina 1". I nomi nuovi non hanno suffisso e restano come sono.
export function nomeBreve(nome: string): string {
  return nome.split(' — ')[0].trim()
}

// Segnaposto dei tabelloni a eliminazione ("Vinc. USA-Belgio", "da definire"): non sono squadre sceglibili.
export function isPlaceholder(team: string): boolean {
  return /^(vinc\.?|vincente|perdente|perd\.?|da definire|tbd|n\.?d\.?)\b/i.test(team.trim())
}

export function squadreDi(partite: { home: string; away: string }[]): string[] {
  return [...new Set(partite.flatMap(p => [p.home, p.away]))].filter(t => t && !isPlaceholder(t))
}

const SKIP = new Set(['fc', 'ac', 'as', 'us', 'ssc', 'calcio', 'under', 'u23', 'sc', 'asd', 'ss'])

// Sigla di due lettere per le squadre senza bandiera: "Juve Stabia" → "JS", "Reggiana" → "RE".
export function sigla(team: string): string {
  const words = team
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w && !SKIP.has(w.toLowerCase()) && !/^\d+$/.test(w))
  if (words.length === 0) return team.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Colore stabile per squadra: lo stesso nome ha sempre lo stesso colore.
const PALETTE = ['#1aff8c', '#22d3ee', '#ffd24a', '#a78bfa', '#f472b6', '#fb923c', '#60a5fa', '#34d399', '#f87171', '#e879f9']
export function coloreSquadra(team: string): string {
  let h = 0
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export interface PartitaIncollata {
  home: string
  away: string
  competizione: string | null
  ora: string | null
}

// Legge un elenco di partite come lo si scrive a mano o in Word:
//   Ore 14.30
//   Reggiana – Torres Serie C
//   Vado – Sanbenedettese
//   Ascoli – EmpoliSerie B
// L'ora e la competizione valgono anche per le righe che seguono, finché non cambiano.
// Le righe che non si riescono a leggere tornano indietro, per non perderle in silenzio.
export function parseElencoPartite(testo: string): { partite: PartitaIncollata[]; scartate: string[] } {
  const partite: PartitaIncollata[] = []
  const scartate: string[] = []
  let ora: string | null = null
  let competizione: string | null = null

  for (const raw of testo.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line) continue

    const oraMatch = /^(?:ore\s*)?(\d{1,2})[.:](\d{2})$/i.exec(line)
    if (oraMatch) {
      ora = `${oraMatch[1].padStart(2, '0')}:${oraMatch[2]}`
      continue
    }

    const serie = /\s*(Serie\s+[ABC])\s*$/i.exec(line)
    if (serie) {
      competizione = 'Serie ' + serie[1].slice(-1).toUpperCase()
      line = line.slice(0, serie.index).trim()
    }

    const parts = line.split(/\s+[-–—]\s+|\s*[–—]\s*/)
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      scartate.push(raw.trim())
      continue
    }
    partite.push({ home: parts[0].trim(), away: parts[1].trim(), competizione, ora })
  }
  return { partite, scartate }
}
