// Risultati automatici: scarica le partite dalla fonte, le abbina a quelle delle
// schedine in corso e salva gol, stato e punti derivati, come farebbe l'admin dal
// pannello Live. Gira sul server con la chiave di servizio (scrive in `risultati`).
// Le regole del gioco restano in lib/live.ts, la lettura della fonte in lib/feed.ts.
import webpush from 'web-push'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildDettaglio, deriveRisultato, matchKey, parseMinute, type DettaglioLive, type GolLive } from './live'
import { abbina, eventiDaElenco, golCoerenti, golDaIncidenti, golNuovi, unisciDettagli, type EventoFeed } from './feed'
import { fineStimataIso } from './giornata'
import { romeOffsetMinutes, romeToUtcIso } from './time'
import { nomeBreve } from './teams'
import { messaggioFinale, messaggioGol, posizioni, type Notifica, type Preferenza } from './push'
import type { MatchDetail, Pronostico, Risultato, Schedina } from './types'

const FONTE = 'https://prod-public-api.livescore.com/v1/api/app'
// Dopo la fine prevista si continua a guardare per due giorni: posticipi, correzioni, recuperi brevi.
const CODA_MS = 48 * 3600 * 1000
// Notifiche solo per i gol freschi: quando si recupera una giornata passata non si avvisa nessuno.
const GOL_FRESCO_MS = 3 * 3600 * 1000

export interface EsitoSchedina {
  id: number
  nome: string
  abbinate: number          // partite trovate nella fonte
  nonTrovate: string[]      // partite che la fonte non conosce: restano all'admin
  daControllare: string[]   // gol che non tornano con il punteggio: non date per finite
  cambiata: boolean
  completa: boolean
  golNotificati: number
}

export interface EsitoSync {
  configurato: boolean
  schedine: EsitoSchedina[]
  cambiate: number
  errore?: string
}

let db: SupabaseClient | null = null
export function dbServizio(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!db) db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return db
}

async function scarica(percorso: string): Promise<unknown> {
  const res = await fetch(`${FONTE}${percorso}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`fonte ${res.status} su ${percorso}`)
  return res.json()
}

// Le partite di un giorno (ora di Roma). Una richiesta per giorno, condivisa fra le schedine.
async function elencoDelGiorno(data: string, cache: Map<string, Promise<EventoFeed[]>>): Promise<EventoFeed[]> {
  if (!cache.has(data)) {
    const fuso = Math.round(romeOffsetMinutes(new Date(`${data}T12:00:00Z`)) / 60)
    cache.set(data, scarica(`/date/soccer/${data.replaceAll('-', '')}/${fuso}`).then(eventiDaElenco))
  }
  return cache.get(data)!
}

const dettagliDi = (r?: Risultato | null): DettaglioLive[] =>
  ((r?.dettagli as MatchDetail[] | undefined) ?? []).map(d => ({
    home: d.home, away: d.away, score: d.score, minuti: d.minuti, gol: d.gol ?? [],
    stato: d.stato ?? 'finita', ...(d.manuale ? { manuale: true } : {}),
  }))

const conclusa = (s: Schedina, r?: Risultato | null) =>
  dettagliDi(r).filter(d => d.stato === 'finita').length === s.partite.length && s.partite.length > 0

// Le schedine da seguire adesso: chiuse (si gioca), non ancora complete, e non più
// vecchie di due giorni dalla fine prevista.
export function daSeguire(schedine: Schedina[], risultati: Map<number, Risultato>, adesso: Date): Schedina[] {
  const ora = adesso.toISOString()
  return schedine.filter(s => s.attiva !== false
    && s.deadline <= ora
    && !conclusa(s, risultati.get(s.id))
    && adesso.getTime() < new Date(fineStimataIso(s)).getTime() + CODA_MS)
}

interface Destinatario { user_id: string; endpoint: string; p256dh: string; auth: string; preferenza: Preferenza }

async function spedisci(sb: SupabaseClient, perDispositivo: (d: Destinatario) => Notifica | null, urgente: boolean): Promise<number> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return 0
  const { data, error } = await sb.from('push_iscrizioni').select('user_id, endpoint, p256dh, auth, preferenza')
  if (error) return 0
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://90egoal.vercel.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  let inviate = 0
  await Promise.all(((data ?? []) as Destinatario[]).map(async d => {
    const n = perDispositivo(d)
    if (!n) return
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(n),
        { TTL: urgente ? 900 : 3600, urgency: urgente ? 'high' : 'normal' })
      inviate++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await sb.from('push_iscrizioni').delete().eq('endpoint', d.endpoint)
      else console.error('push auto', status, (err as Error).message)
    }
  }))
  return inviate
}

async function sincronizzaSchedina(
  sb: SupabaseClient, s: Schedina, prec: Risultato | undefined, adesso: Date,
  elenchi: Map<string, Promise<EventoFeed[]>>,
): Promise<EsitoSchedina> {
  const esito: EsitoSchedina = { id: s.id, nome: nomeBreve(s.nome), abbinate: 0, nonTrovate: [], daControllare: [], cambiata: false, completa: false, golNotificati: 0 }
  const salvati = dettagliDi(prec)
  const giaSalvati = new Map(salvati.map(d => [matchKey(d), d]))

  const date = [...new Set(s.partite.map(p => p.date).filter(Boolean))]
  const eventi = (await Promise.all(date.map(d => elencoDelGiorno(d, elenchi)))).flat()

  const daFeed = new Map<string, DettaglioLive>()
  const freschi: { p: Schedina['partite'][number]; gol: GolLive; score: string }[] = []
  await Promise.all(s.partite.map(async p => {
    const k = matchKey(p)
    if (giaSalvati.get(k)?.manuale) return
    const e = abbina(p, eventi)
    if (!e) { esito.nonTrovate.push(`${p.home} - ${p.away}`); return }
    esito.abbinate++
    if (!e.stato || e.stato === 'da_giocare') return
    const gol = golDaIncidenti(await scarica(`/incidents/soccer/${e.id}`), p.home, p.away)
    let stato = e.stato
    if (stato === 'finita' && !golCoerenti(gol, e, p.home, p.away)) {
      esito.daControllare.push(`${p.home} - ${p.away}: la fonte dice ${e.golCasa}-${e.golTrasferta}, i gol elencati sono ${gol.length}`)
      stato = 'in_corso'
    }
    const d = buildDettaglio(p, gol, stato)
    daFeed.set(k, d)
    const inizio = p.ora ? new Date(romeToUtcIso(p.date, p.ora)).getTime() : 0
    if (adesso.getTime() - inizio < GOL_FRESCO_MS) {
      for (const g of golNuovi(giaSalvati.get(k)?.gol ?? [], d.gol)) freschi.push({ p, gol: g, score: d.score })
    }
  }))

  const dettagli = unisciDettagli(s.partite, salvati, daFeed)
  if (!prec && dettagli.length === 0) return esito          // niente è ancora cominciato
  const d = deriveRisultato(s.partite, dettagli)
  esito.completa = d.completa
  if (prec && JSON.stringify(dettagli) === JSON.stringify(salvati)) return esito

  const { error } = await sb.from('risultati').upsert({
    schedina_id: s.id, dettagli,
    minuti_gol: d.minuti_gol, recupero: d.recupero,
    first_goal_team: d.first_goal_team, last_goal_team: d.last_goal_team,
    minuto_primo_gol: d.minuto_primo_gol, minuto_ultimo_gol: d.minuto_ultimo_gol,
    extra_time: prec?.extra_time ?? null, note: prec?.note ?? null,
  }, { onConflict: 'schedina_id' })
  if (error) throw new Error(`salvataggio schedina ${s.id}: ${error.message}`)
  esito.cambiata = true

  // Notifiche: i gol appena arrivati, e la chiusura della giornata se è appena finita.
  const appenaFinita = d.completa && !conclusa(s, prec) && adesso.getTime() < new Date(fineStimataIso(s)).getTime() + GOL_FRESCO_MS
  if (freschi.length > 0 || appenaFinita) {
    const { data: pr } = await sb.from('pronostici').select('*').eq('schedina_id', s.id)
    const pron = new Map(((pr ?? []) as Pronostico[]).map(p => [p.user_id, p]))
    for (const f of freschi.slice(0, 6)) {
      const m = parseMinute(f.gol.min)
      if (!m) continue
      const g = { schedinaId: s.id, home: f.p.home, away: f.p.away, score: f.score, min: f.gol.min, base: m.base, extra: m.extra, team: f.gol.team, scorer: f.gol.scorer }
      esito.golNotificati += (await spedisci(sb, dest => {
        const p = pron.get(dest.user_id)
        return messaggioGol(g, p ? { minuti: p.minuti, recupero: p.recupero } : undefined, dest.preferenza)
      }, true)) > 0 ? 1 : 0
    }
    if (appenaFinita) {
      const { data: cl } = await sb.from('classifica').select('user_id, totale').eq('schedina_id', s.id)
      const righe = (cl ?? []) as { user_id: string; totale: number }[]
      const pos = posizioni(righe)
      const punti = new Map(righe.map(r => [r.user_id, r.totale]))
      await spedisci(sb, dest => punti.has(dest.user_id)
        ? messaggioFinale(s.id, nomeBreve(s.nome), punti.get(dest.user_id)!, pos.get(dest.user_id)!, righe.length)
        : null, false)
    }
  }
  return esito
}

// Un giro completo. Con `soloId` aggiorna quella schedina anche fuori dalla finestra
// (lo usa l'admin per recuperare una giornata vecchia).
export async function sincronizza(adesso = new Date(), soloId?: number): Promise<EsitoSync> {
  const sb = dbServizio()
  if (!sb) return { configurato: false, schedine: [], cambiate: 0, errore: 'Manca SUPABASE_SERVICE_ROLE_KEY.' }
  const [{ data: sRaw, error: e1 }, { data: rRaw, error: e2 }] = await Promise.all([
    sb.from('schedine').select('*').order('id'),
    sb.from('risultati').select('*'),
  ])
  if (e1 || e2) return { configurato: true, schedine: [], cambiate: 0, errore: (e1 ?? e2)!.message }
  const schedine = (sRaw ?? []) as Schedina[]
  const risultati = new Map(((rRaw ?? []) as Risultato[]).map(r => [r.schedina_id, r]))
  const scelte = soloId !== undefined
    ? schedine.filter(s => s.id === soloId && s.deadline <= adesso.toISOString())
    : daSeguire(schedine, risultati, adesso)

  const elenchi = new Map<string, Promise<EventoFeed[]>>()
  const esiti: EsitoSchedina[] = []
  let errore: string | undefined
  for (const s of scelte) {
    try { esiti.push(await sincronizzaSchedina(sb, s, risultati.get(s.id), adesso, elenchi)) }
    catch (err) { errore = (err as Error).message; console.error('risultati auto', s.id, errore) }
  }
  return { configurato: true, schedine: esiti, cambiate: esiti.filter(e => e.cambiata).length, ...(errore ? { errore } : {}) }
}
