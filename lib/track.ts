import { createClient } from '@/lib/supabase/client'

// Registra un evento di percorso utente (fire-and-forget: non blocca mai la UI).
export async function logEvent(event: string, opts?: { schedina_id?: number | null; ms?: number | null }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('events').insert({
      user_id: user.id,
      event,
      schedina_id: opts?.schedina_id ?? null,
      ms: opts?.ms ?? null,
    })
  } catch {
    /* tracciamento non critico: ignora errori (es. tabella non ancora migrata) */
  }
}
