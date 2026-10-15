import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Schedina } from '@/lib/types'
import { SCHEDINA_PROVA } from '@/lib/demo'
import ProvaClient from '@/components/ProvaClient'

export const metadata: Metadata = { title: 'Prova — 90 & Goal' }

// Si gioca subito, senza account: la schedina resta sul telefono.
// La prossima giornata vera se il database risponde, altrimenti quella di riserva.
export default async function ProvaPage() {
  let schedina: Schedina = SCHEDINA_PROVA
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('schedine').select('*').eq('attiva', true).gt('deadline', new Date().toISOString()).order('deadline').limit(1)
    if (data?.[0]) schedina = data[0] as Schedina
  } catch {
    /* database non raggiungibile: si gioca con la schedina di riserva */
  }
  return <ProvaClient schedina={schedina} />
}
