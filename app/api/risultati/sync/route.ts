// Risultati automatici: un giro di aggiornamento dalle partite vere.
//
// GET senza parametri: aggiorna le schedine che si stanno giocando. Lo chiamano
// l'app aperta dei giocatori (una volta al minuto), il cron di Vercel e, se attivato,
// quello di Supabase. È aperto a tutti perché non accetta dati: legge la fonte e
// salva quello che trova. Un freno evita che richieste ravvicinate rifacciano il giro.
//
// GET ?schedina=ID: solo admin, aggiorna quella schedina anche se è vecchia.
import { createClient } from '@/lib/supabase/server'
import { sincronizza, type EsitoSync } from '@/lib/risultatiAuto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const FRENO_MS = 25_000
let ultimo: { at: number; esito: EsitoSync } | null = null
// Quando è cambiato qualcosa l'ultima volta: l'app aperta ricarica la pagina solo se questo numero cambia.
let ultimoCambio = 0

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('schedina')

  if (id !== null) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = user ? await supabase.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null }
    if (!data?.is_admin) return json({ error: 'Solo admin.' }, 403)
    if (!/^\d+$/.test(id)) return json({ error: 'Schedina non valida.' }, 400)
    const esito = await sincronizza(new Date(), Number(id))
    return json(esito, esito.configurato ? 200 : 503)
  }

  // Dentro il freno si risponde con l'ultimo esito, senza rifare il giro.
  if (ultimo && Date.now() - ultimo.at < FRENO_MS) return json({ ...ultimo.esito, ultimoCambio, recente: true })
  const esito = await sincronizza()
  ultimo = { at: Date.now(), esito }
  if (esito.cambiate > 0) ultimoCambio = Date.now()
  return json({ ...esito, ultimoCambio }, esito.configurato ? 200 : 503)
}
