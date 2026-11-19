import type { SupabaseClient } from '@supabase/supabase-js'

// Leghe tra amici: un gruppo con un codice d'invito. Le schedine sono le stesse
// per tutti, la classifica della lega è quella del torneo filtrata sui membri.

export interface Lega {
  id: string
  nome: string
  codice: string
  creata_da: string
  created_at: string
}

export interface LegaConMembri extends Lega {
  membri: string[] // user_id
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://90egoal.vercel.app'

export const linkInvito = (codice: string) => `${SITE}/leghe/entra/${codice}`

export const testoInvito = (lega: Pick<Lega, 'nome' | 'codice'>) =>
  `Entra nella mia lega "${lega.nome}" su 90 & Goal: scegli 13 minuti, ogni gol in uno dei tuoi è un punto. ${linkInvito(lega.codice)}`

// Le leghe di cui l'utente fa parte, con i membri di ciascuna.
// Se la tabella non c'è ancora (migrazione non eseguita) torna una lista vuota.
export async function mieLeghe(supabase: SupabaseClient, userId: string): Promise<LegaConMembri[]> {
  const { data: mie, error } = await supabase.from('leghe_membri').select('lega_id').eq('user_id', userId)
  if (error || !mie?.length) return []
  const ids = mie.map(m => m.lega_id as string)
  const [{ data: leghe }, { data: membri }] = await Promise.all([
    supabase.from('leghe').select('*').in('id', ids).order('created_at'),
    supabase.from('leghe_membri').select('lega_id, user_id').in('lega_id', ids),
  ])
  return ((leghe ?? []) as Lega[]).map(l => ({
    ...l,
    membri: ((membri ?? []) as { lega_id: string; user_id: string }[]).filter(m => m.lega_id === l.id).map(m => m.user_id),
  }))
}

// Messaggi d'errore delle funzioni del database, detti come li direbbe una persona.
export function erroreLega(msg: string | undefined): string {
  if (!msg) return 'Qualcosa non ha funzionato. Riprova.'
  if (msg.includes('codice non trovato')) return 'Nessuna lega con questo codice. Controlla le lettere.'
  if (msg.includes('lega piena')) return 'Questa lega è al completo.'
  if (msg.includes('troppe leghe')) return 'Hai già creato il numero massimo di leghe.'
  if (msg.includes('nome non valido')) return 'Il nome deve avere da 2 a 40 caratteri.'
  if (msg.includes('accesso richiesto')) return 'Accedi per continuare.'
  return 'Qualcosa non ha funzionato. Riprova.'
}

// Dopo accesso o registrazione si torna dove si era partiti (es. un invito a una lega).
// Solo percorsi interni: niente "//altrosito" o indirizzi completi.
export function percorsoDopoAccesso(): string {
  if (typeof window === 'undefined') return '/'
  const next = new URLSearchParams(window.location.search).get('next') ?? ''
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}

// Per leggere valori del browser (indirizzo, localStorage) senza effetti e senza
// differenze fra server e telefono: sul server vale il default.
export const nessunaIscrizione = () => () => {}
export const suffissoRitorno = () => {
  const n = percorsoDopoAccesso()
  return n !== '/' ? `?next=${encodeURIComponent(n)}` : ''
}
