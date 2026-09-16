import { createClient } from '@/lib/supabase/server'
import { BrainError } from './errors'

/**
 * Chi può entrare.
 *
 * Questa è la memoria personale di una persona: mail, contratti,
 * movimenti del conto, dati del sonno. Non è "un'area riservata",
 * è l'area di *uno*. Quindi il controllo è volutamente stretto:
 *
 *  - con `BRAIN_OWNER_EMAIL` impostata, entra solo quell'indirizzo;
 *  - senza, entra solo chi è già amministratore del sito.
 *
 * Il default in assenza di configurazione è chiudere, non aprire.
 */

export type Owner = { id: string; email: string }

export async function currentOwner(): Promise<Owner | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null

  const expected = process.env.BRAIN_OWNER_EMAIL?.trim().toLowerCase()
  if (expected) {
    return user.email.toLowerCase() === expected ? { id: user.id, email: user.email } : null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin ? { id: user.id, email: user.email } : null
}

/** Come sopra, ma per le route: solleva invece di restituire null. */
export async function requireOwner(): Promise<Owner> {
  const owner = await currentOwner()
  if (!owner) throw new BrainError('Area riservata al proprietario della memoria.', 403)
  return owner
}
