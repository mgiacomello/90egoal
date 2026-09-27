import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { MatchDetail, Pronostico, Schedina } from '@/lib/types'
import { parseMinute, matchKey } from '@/lib/live'
import { nomeBreve } from '@/lib/teams'
import { messaggioFinale, messaggioGol, messaggioPromemoria, posizioni, type Notifica, type Preferenza } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Destinatario { user_id: string; endpoint: string; p256dh: string; auth: string; preferenza: Preferenza }

type Richiesta =
  | { tipo: 'gol'; schedina_id: number; gol: { home: string; away: string; min: string; team: string } }
  | { tipo: 'finale'; schedina_id: number }
  | { tipo: 'promemoria'; schedina_id: number }
  | { tipo: 'messaggio'; titolo: string; testo: string; url?: string }
  | { tipo: 'prova' }

function configurato() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

// Solo un admin loggato può inviare: la sessione è quella del pannello.
async function admin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? { supabase, user } : null
}

// Stato per il pannello admin: configurazione e numero di dispositivi iscritti.
export async function GET() {
  const a = await admin()
  if (!a) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  const { data, error } = await a.supabase.rpc('push_destinatari')
  const righe = (data ?? []) as Destinatario[]
  return Response.json({
    configurato: configurato(),
    migrazione: !error,
    dispositivi: righe.length,
    giocatori: new Set(righe.map(r => r.user_id)).size,
    soloMiei: righe.filter(r => r.preferenza === 'miei').length,
  })
}

export async function POST(request: Request) {
  const a = await admin()
  if (!a) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  if (!configurato()) return Response.json({ error: 'Notifiche non configurate: mancano le chiavi VAPID su Vercel.' }, { status: 503 })

  let req: Richiesta
  try { req = await request.json() } catch { return Response.json({ error: 'Richiesta non valida.' }, { status: 400 }) }

  const { supabase, user } = a
  const { data: dest, error: destErr } = await supabase.rpc('push_destinatari')
  if (destErr) return Response.json({ error: 'Iscrizioni non leggibili: eseguire migration_push.sql.' }, { status: 500 })
  const destinatari = (dest ?? []) as Destinatario[]

  // Per ogni dispositivo, il messaggio giusto (o nessuno).
  let perDispositivo: (d: Destinatario) => Notifica | null
  let ttl = 3600

  if (req.tipo === 'prova') {
    perDispositivo = d => d.user_id === user.id
      ? { title: '🔔 Prova riuscita', body: 'Le notifiche di 90 & Goal arrivano su questo dispositivo.', url: '/admin', tag: 'prova' }
      : null
  } else if (req.tipo === 'messaggio') {
    const titolo = String(req.titolo ?? '').trim().slice(0, 80)
    const testo = String(req.testo ?? '').trim().slice(0, 200)
    if (!titolo || !testo) return Response.json({ error: 'Servono titolo e testo.' }, { status: 400 })
    const url = typeof req.url === 'string' && req.url.startsWith('/') ? req.url : '/'
    perDispositivo = () => ({ title: titolo, body: testo, url, tag: `msg-${Date.now()}` })
  } else {
    const { data: s } = await supabase.from('schedine').select('*').eq('id', req.schedina_id).single()
    const schedina = s as Schedina | null
    if (!schedina) return Response.json({ error: 'Schedina non trovata.' }, { status: 404 })
    const nome = nomeBreve(schedina.nome)
    const { data: pr } = await supabase.from('pronostici').select('*').eq('schedina_id', schedina.id)
    const pron = new Map(((pr ?? []) as Pronostico[]).map(p => [p.user_id, p]))

    if (req.tipo === 'gol') {
      const m = parseMinute(req.gol?.min ?? '')
      if (!m) return Response.json({ error: 'Minuto non valido.' }, { status: 400 })
      // Il punteggio si prende dal database, già aggiornato dal pannello live.
      const { data: r } = await supabase.from('risultati').select('dettagli').eq('schedina_id', schedina.id).single()
      const dett = ((r?.dettagli ?? []) as MatchDetail[]).find(d => matchKey(d) === matchKey(req.gol))
      const g = {
        schedinaId: schedina.id, home: req.gol.home, away: req.gol.away, score: dett?.score ?? '',
        min: req.gol.min, base: m.base, extra: m.extra, team: req.gol.team,
      }
      ttl = 900 // un gol vecchio di un quarto d'ora non serve più a nessuno
      perDispositivo = d => {
        const p = pron.get(d.user_id)
        return messaggioGol(g, p ? { minuti: p.minuti, recupero: p.recupero } : undefined, d.preferenza)
      }
    } else if (req.tipo === 'finale') {
      const { data: cl } = await supabase.from('classifica').select('user_id, totale').eq('schedina_id', schedina.id)
      const righe = (cl ?? []) as { user_id: string; totale: number }[]
      const pos = posizioni(righe)
      const punti = new Map(righe.map(r => [r.user_id, r.totale]))
      perDispositivo = d => punti.has(d.user_id)
        ? messaggioFinale(schedina.id, nome, punti.get(d.user_id)!, pos.get(d.user_id)!, righe.length)
        : null
    } else if (req.tipo === 'promemoria') {
      if (new Date(schedina.deadline) <= new Date()) return Response.json({ error: 'La schedina è già chiusa.' }, { status: 400 })
      const ora = new Date(schedina.deadline).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
      // Solo a chi non ha ancora giocato: gli altri non hanno niente da fare.
      perDispositivo = d => (pron.has(d.user_id) ? null : messaggioPromemoria(schedina.id, nome, ora))
    } else {
      return Response.json({ error: 'Tipo sconosciuto.' }, { status: 400 })
    }
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://90egoal.vercel.app',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  let inviate = 0
  let saltate = 0
  let rimosse = 0
  let errori = 0
  await Promise.all(destinatari.map(async d => {
    const n = perDispositivo(d)
    if (!n) { saltate++; return }
    try {
      await webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify(n),
        { TTL: ttl, urgency: req.tipo === 'gol' ? 'high' : 'normal' },
      )
      inviate++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404/410: il dispositivo ha revocato il permesso o disinstallato l'app.
      if (status === 404 || status === 410) {
        await supabase.rpc('push_rimuovi', { p_endpoint: d.endpoint })
        rimosse++
      } else {
        errori++
        console.error('push error', status, (err as Error).message)
      }
    }
  }))

  return Response.json({ inviate, saltate, rimosse, errori })
}
