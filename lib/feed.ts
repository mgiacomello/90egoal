// Risultati automatici: dalla fonte esterna (LiveScore) ai gol della schedina.
// Qui solo funzioni pure, senza rete né database: testate in scripts/game.test.ts.
// Chi scarica e chi salva sta in lib/risultatiAuto.ts.
import { matchKey, parseMinute, formatMinute, type DettaglioLive, type GolLive, type StatoPartita } from './live.ts'

export type Serie = 'A' | 'B' | 'C'

// Una partita come la vede la fonte, già ridotta a quello che serve.
export interface EventoFeed {
  id: string
  serie: Serie
  home: string
  away: string
  data: string                  // "2026-11-21", nel fuso chiesto alla fonte (Roma)
  stato: StatoPartita | null    // null: rinviata, sospesa, annullata… non si tocca
  golCasa: number | null
  golTrasferta: number | null
}

// "Serie A", "Serie B", "Serie C - Girone B" → A, B, C. Altro (coppe, Mondiali) → null.
export function serieDi(competizione?: string | null): Serie | null {
  const m = /serie\s*([abc])\b/i.exec(competizione ?? '')
  return m ? (m[1].toUpperCase() as Serie) : null
}

// Sigle societarie e parole che la fonte aggiunge o toglie: "Como 1907", "Cesena FC",
// "S.S. Arezzo", "Pescara Calcio", "Team Altamura", "AZ Picerno ASD".
const RUMORE = new Set(['fc', 'ac', 'as', 'asd', 'ssd', 'ss', 'ssc', 'us', 'usd', 'uc', 'az', 'cfc', 'bc', 'calcio', 'team'])
// Parole che distinguono una seconda squadra dalla prima: "Inter" non è "Inter U23".
const SECONDA = new Set(['u23', 'u21', 'u19', 'next', 'gen', 'primavera', 'women', 'femminile', 'ii', 'b'])

export function paroleSquadra(nome: string): string[] {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // Südtirol → Sudtirol, Forlì → Forli
    .toLowerCase()
    .replace(/\b([a-z])\.(?=[a-z]\b)/g, '$1')            // L.R. → lr, S.S. → ss
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(w => w && !RUMORE.has(w) && !/^(18|19|20)\d\d$/.test(w))
}

// Stessa squadra se, tolto il rumore, i nomi coincidono o uno contiene l'altro
// ("Alcione" e "Alcione Milano"), purché non sia la differenza fra prima e seconda squadra.
export function stessaSquadra(a: string, b: string): boolean {
  const pa = paroleSquadra(a)
  const pb = paroleSquadra(b)
  if (!pa.length || !pb.length) return false
  const [corto, lungo] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
  if (!corto.every(w => lungo.includes(w))) return false
  return !lungo.some(w => !corto.includes(w) && SECONDA.has(w))
}

const giorni = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000

// La partita della schedina dentro l'elenco della fonte: stessa serie, stesse due
// squadre nello stesso verso, stesso giorno (o quello accanto, per posticipi a cavallo
// della mezzanotte). Se ne risultano due, non si sceglie: meglio nessuna che quella sbagliata.
export function abbina(p: { home: string; away: string; date: string; competizione?: string | null }, eventi: EventoFeed[]): EventoFeed | null {
  const serie = serieDi(p.competizione)
  if (!serie) return null
  const trovati = eventi.filter(e => e.serie === serie
    && stessaSquadra(p.home, e.home) && stessaSquadra(p.away, e.away)
    && (!p.date || giorni(p.date, e.data) <= 1))
  const unici = [...new Map(trovati.map(e => [e.id, e])).values()]
  return unici.length === 1 ? unici[0] : null
}

// Stato della partita secondo la fonte: "NS", "FT", "HT", "67'", "90+3'", "Postp."…
export function statoDaFeed(eps: unknown): StatoPartita | null {
  const s = String(eps ?? '').trim()
  if (s === 'NS') return 'da_giocare'
  if (s === 'FT' || s === 'AET' || s === 'AP') return 'finita'
  if (s === 'HT' || /^\d{1,3}(\+\d{1,2})?'$/.test(s)) return 'in_corso'
  return null
}

interface StageGrezzo { Cnm?: string; Scd?: string; Events?: EventoGrezzo[] }
interface EventoGrezzo { Eid?: string | number; Esd?: number | string; Eps?: string; Tr1?: string; Tr2?: string; T1?: { Nm?: string }[]; T2?: { Nm?: string }[] }

// L'elenco delle partite di un giorno → solo Serie A, B e C maschili.
export function eventiDaElenco(json: unknown): EventoFeed[] {
  const stages = ((json as { Stages?: StageGrezzo[] } | null)?.Stages ?? [])
  const out: EventoFeed[] = []
  for (const s of stages) {
    const m = /^serie-([abc])(-|$)/.exec(s.Scd ?? '')
    if (s.Cnm !== 'Italy' || !m || /women/.test(s.Scd ?? '')) continue
    for (const e of s.Events ?? []) {
      const home = e.T1?.[0]?.Nm
      const away = e.T2?.[0]?.Nm
      const esd = String(e.Esd ?? '')
      if (!e.Eid || !home || !away || esd.length < 8) continue
      const n = (v?: string) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : null)
      out.push({
        id: String(e.Eid), serie: m[1].toUpperCase() as Serie, home, away,
        data: `${esd.slice(0, 4)}-${esd.slice(4, 6)}-${esd.slice(6, 8)}`,
        stato: statoDaFeed(e.Eps), golCasa: n(e.Tr1), golTrasferta: n(e.Tr2),
      })
    }
  }
  return out
}

interface IncidenteGrezzo { Min?: number; MinEx?: number; Nm?: number; IT?: number; Pn?: string; Ln?: string; Pnum?: number; Incs?: IncidenteGrezzo[] }

// Tipi di episodio che sono un gol: 36 gol, 37 rigore segnato, 39 autogol (la fonte lo
// assegna già alla squadra che ne beneficia). Tutto il resto (assist, cartellini,
// rigori sbagliati, VAR) non conta.
const GOL = new Set([36, 37, 39])

// Gli episodi di una partita → i suoi gol, con il minuto scritto come nel gioco:
// "23'", "45+2'", "90+4'". Il marcatore porta il numero di maglia ("Lukaku 11").
export function golDaIncidenti(json: unknown, home: string, away: string): GolLive[] {
  const tempi = ((json as { Incs?: Record<string, IncidenteGrezzo[]> } | null)?.Incs ?? {})
  const out: GolLive[] = []
  for (const tempo of Object.keys(tempi).sort()) {
    for (const gruppo of tempi[tempo] ?? []) {
      for (const x of gruppo.Incs ?? [gruppo]) {
        if (!GOL.has(x.IT ?? -1) || (x.Nm !== 1 && x.Nm !== 2)) continue
        const m = parseMinute(`${x.Min ?? ''}${x.MinEx ? `+${x.MinEx}` : ''}`)
        if (!m) continue
        const nome = (x.Ln || x.Pn || '').trim()
        const scorer = x.IT !== 39 && nome ? `${nome}${x.Pnum ? ` ${x.Pnum}` : ''}`.slice(0, 40) : undefined
        out.push({ min: formatMinute(m), team: x.Nm === 1 ? home : away, ...(scorer ? { scorer } : {}) })
      }
    }
  }
  return out
}

// I gol contati tornano con il punteggio dichiarato dalla fonte? Se no, il dettaglio
// è incompleto (succede nelle serie minori): la partita non va data per finita.
export function golCoerenti(gol: GolLive[], e: EventoFeed, home: string, away: string): boolean {
  if (e.golCasa === null || e.golTrasferta === null) return true
  return gol.filter(g => g.team === home).length === e.golCasa && gol.filter(g => g.team === away).length === e.golTrasferta
}

// I gol comparsi rispetto a prima (per le notifiche). Due gol uguali per minuto e
// squadra contano due volte: si confrontano le quantità, non la sola presenza.
export function golNuovi(prima: GolLive[], dopo: GolLive[]): GolLive[] {
  const visti = new Map<string, number>()
  for (const g of prima) visti.set(`${g.min}|${g.team}`, (visti.get(`${g.min}|${g.team}`) ?? 0) + 1)
  const out: GolLive[] = []
  for (const g of dopo) {
    const k = `${g.min}|${g.team}`
    const n = visti.get(k) ?? 0
    if (n > 0) visti.set(k, n - 1)
    else out.push(g)
  }
  return out
}

// Mette insieme il dettaglio salvato e quello arrivato dalla fonte, partita per partita:
// - una partita corretta a mano dall'admin (manuale) non si tocca;
// - una partita che la fonte conosce ed è cominciata prende i dati della fonte;
// - tutte le altre restano com'erano.
export function unisciDettagli(
  partite: { home: string; away: string }[],
  salvati: DettaglioLive[],
  daFeed: Map<string, DettaglioLive>,
): DettaglioLive[] {
  const prima = new Map(salvati.map(d => [matchKey(d), d]))
  const out: DettaglioLive[] = []
  for (const p of partite) {
    const k = matchKey(p)
    const vecchio = prima.get(k)
    const nuovo = daFeed.get(k)
    if (vecchio?.manuale || !nuovo) { if (vecchio) out.push(vecchio); continue }
    out.push(nuovo)
  }
  return out
}
