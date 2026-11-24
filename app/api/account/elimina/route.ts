// Eliminazione dell'account, chiesta dal giocatore dal Profilo.
// Cancella l'utente di Supabase: profilo, schedine giocate, leghe create, iscrizioni alle
// leghe, notifiche e dati di utilizzo spariscono a cascata (tutte le tabelle hanno
// "on delete cascade" verso auth.users). Non si torna indietro.
import { createClient } from '@/lib/supabase/server'
import { dbServizio } from '@/lib/risultatiAuto'
import { linguaServer } from '@/lib/lingua.server'
import { txDi } from '@/lib/lingua'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request) {
  const tx = txDi(await linguaServer())
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ errore: tx('Devi aver fatto l\'accesso.', 'You must be signed in.') }, 401)

  const { data: profilo } = await supabase.from('profiles').select('username, is_admin').eq('id', user.id).single()
  // Chi amministra il gioco non si cancella da qui: resterebbe senza nessuno che inserisce i risultati.
  if (profilo?.is_admin) return json({ errore: tx('Un account admin non si elimina da qui.', 'An admin account cannot be deleted from here.') }, 403)

  // Conferma esplicita: il nickname scritto a mano, così un tocco per sbaglio non basta.
  const body = await request.json().catch(() => null) as { conferma?: string } | null
  const scritto = (body?.conferma ?? '').trim().toLowerCase()
  if (!profilo?.username || scritto !== profilo.username.toLowerCase()) {
    return json({ errore: tx('Il nickname non corrisponde.', 'The nickname does not match.') }, 400)
  }

  const servizio = dbServizio()
  if (!servizio) return json({ errore: tx('Eliminazione non disponibile in questo momento. Scrivi a privacy@goalgames.it.', 'Deletion is not available right now. Write to privacy@goalgames.it.') }, 503)

  const { error } = await servizio.auth.admin.deleteUser(user.id)
  if (error) return json({ errore: tx('Non è stato possibile eliminare l\'account. Riprova tra poco.', 'The account could not be deleted. Try again shortly.') }, 500)

  await supabase.auth.signOut()
  return json({ ok: true })
}
