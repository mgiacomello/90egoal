import type { SupabaseClient } from '@supabase/supabase-js'
import { PROVA_KEY, type PronosticoProva } from '@/lib/demo'

// Chi ha giocato la schedina di prova e poi si registra (o accede) non deve
// rifare i 13 minuti: li inviamo noi, se la giornata è ancora aperta.
// Torna il nome della schedina trasferita, o null se non c'era niente da fare.
export async function trasferisciProva(supabase: SupabaseClient, userId: string): Promise<string | null> {
  let prova: PronosticoProva | null = null
  try {
    const raw = localStorage.getItem(PROVA_KEY)
    prova = raw ? (JSON.parse(raw) as PronosticoProva) : null
  } catch {
    return null
  }
  if (!prova || !prova.schedina_id || prova.minuti.length !== 13) return null

  const { error } = await supabase.from('pronostici').insert({
    user_id: userId,
    schedina_id: prova.schedina_id,
    minuti: prova.minuti,
    recupero: prova.recupero,
    first_goal: prova.first_goal,
    last_goal: prova.last_goal,
    extra_time: null,
  })
  // Giornata chiusa, o pronostico già presente: la prova non serve più in ogni caso.
  try { localStorage.removeItem(PROVA_KEY) } catch { /* ignora */ }
  return error ? null : prova.nome
}
