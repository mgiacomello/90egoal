import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ScedinaForm from '@/components/ScedinaForm'
import { computeGoalStats } from '@/lib/goalStats'
import { Risultato } from '@/lib/types'

export default async function ScedinaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: schedina } = await supabase
    .from('schedine')
    .select('*')
    .eq('id', id)
    .single()

  if (!schedina) notFound()

  const deadline = new Date(schedina.deadline)
  if (new Date() > deadline) redirect('/schedine')

  // Pronostico definitivo: se già inviato, non è più modificabile → torna all'elenco
  const { data: pronostico } = await supabase
    .from('pronostici')
    .select('id')
    .eq('user_id', user.id)
    .eq('schedina_id', id)
    .maybeSingle()

  if (pronostico) redirect('/schedine')

  // Statistiche gol del torneo (sessione tecnica) — da tutte le partite giocate
  const { data: risultati } = await supabase.from('risultati').select('*')
  const goalStats = computeGoalStats((risultati as Risultato[] | null) ?? [])

  return (
    <ScedinaForm
      schedina={schedina}
      pronosticoEsistente={null}
      userId={user.id}
      goalStats={goalStats}
    />
  )
}
