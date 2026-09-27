// Notifiche push: chi riceve cosa, e con quali parole. Funzioni pure, senza dipendenze:
// testate in scripts/game.test.ts. L'invio vero sta in app/api/push/send/route.ts.

export type Preferenza = 'tutti' | 'miei'

export interface Notifica {
  title: string
  body: string
  url: string
  tag: string
}

export interface PronosticoPush {
  minuti: number[]
  recupero: 'primo' | 'secondo' | null
}

export interface GolPush {
  schedinaId: number
  home: string
  away: string
  score: string        // "1-0"
  min: string          // "23'", "45+2'"
  base: number
  extra: number
  team: string
}

// Il gol "è tuo" se cade in uno dei tuoi minuti, o nel recupero del tempo che hai scelto.
export function golPreso(g: Pick<GolPush, 'base' | 'extra'>, p: PronosticoPush): boolean {
  if (g.extra === 0) return g.base >= 1 && g.base <= 90 && p.minuti.includes(g.base)
  if (g.base === 45) return p.recupero === 'primo'
  if (g.base === 90) return p.recupero === 'secondo'
  return false
}

// Notifica di gol per un giocatore. Null se non deve riceverla:
// - chi non ha giocato la schedina non riceve i gol (non gli dicono niente);
// - chi ha scelto "solo i miei" riceve solo i gol che gli portano punti.
export function messaggioGol(g: GolPush, p: PronosticoPush | undefined, pref: Preferenza): Notifica | null {
  if (!p) return null
  const preso = golPreso(g, p)
  if (pref === 'miei' && !preso) return null
  const partita = `${g.home} ${g.score} ${g.away}`
  const title = !preso
    ? `⚽ Gol al ${g.min}`
    : g.extra > 0
      ? `🎯 Gol nel recupero! ${g.min}`
      : `🎯 Il tuo ${g.base}' è uscito!`
  const body = `${partita} · segna ${g.team}${preso && g.extra > 0 ? ' · bonus recupero' : ''}`
  return { title, body, url: '/schedine', tag: `gol-${g.schedinaId}-${g.home}-${g.min}-${g.team}` }
}

export interface RigaPunti {
  user_id: string
  totale: number
}

// Posizioni con i pari merito: 10, 8, 8, 5 → 1°, 2°, 2°, 4°.
export function posizioni(righe: RigaPunti[]): Map<string, number> {
  const ordinate = [...righe].sort((a, b) => b.totale - a.totale)
  const out = new Map<string, number>()
  ordinate.forEach((r, i) => {
    const prev = ordinate[i - 1]
    out.set(r.user_id, prev && prev.totale === r.totale ? out.get(prev.user_id)! : i + 1)
  })
  return out
}

export function messaggioFinale(schedinaId: number, nome: string, punti: number, pos: number, di: number): Notifica {
  return {
    title: `🏁 ${nome}: è finita`,
    body: `Hai fatto ${punti} ${punti === 1 ? 'punto' : 'punti'}, sei ${pos}° su ${di}. Guarda la classifica.`,
    url: '/classifica',
    tag: `finale-${schedinaId}`,
  }
}

export function messaggioPromemoria(schedinaId: number, nome: string, ora: string): Notifica {
  return {
    title: `⏳ ${nome} chiude alle ${ora}`,
    body: 'Scegli i tuoi 13 minuti prima del calcio d’inizio.',
    url: `/schedine/${schedinaId}`,
    tag: `promemoria-${schedinaId}`,
  }
}
