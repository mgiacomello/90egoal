import { createClient } from '@/lib/supabase/server'
import { BrainError } from './errors'

/**
 * Chi può entrare.
 *
 * Questa è la memoria personale di una persona: mail, contratti,
 * movimenti del conto, dati del sonno. Non è "un'area riservata", è
 * l'area di *uno*. Quindi il controllo è volutamente stretto e senza
 * scorciatoie: entra **solo** l'indirizzo in `BRAIN_OWNER_EMAIL`.
 *
 * Senza quella variabile non entra nessuno. È scomodo al primo avvio,
 * ed è giusto così: il default in assenza di configurazione dev'essere
 * chiudere, non aprire, e un progetto che si apre da solo finché non
 * lo configuri è un progetto che qualcuno prima o poi dimentica di
 * configurare.
 *
 * La sessione Supabase apre il cancello; questo controllo dice che sei
 * tu. Vale anche se sullo stesso progetto Supabase esistono altri
 * account — averne uno non basta per entrare qui.
 */

export type Owner = { id: string; email: string }

export async function currentOwner(): Promise<Owner | null> {
  const expected = process.env.BRAIN_OWNER_EMAIL?.trim().toLowerCase()
  if (!expected) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null

  return user.email.toLowerCase() === expected ? { id: user.id, email: user.email } : null
}

/** Come sopra, ma per le route: solleva invece di restituire null. */
export async function requireOwner(): Promise<Owner> {
  const owner = await currentOwner()
  if (!owner) throw new BrainError('Area riservata al proprietario della memoria.', 403)
  return owner
}
