import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ScedinaForm from '@/components/ScedinaForm'
import { computeGoalStats, computeTeamGoalStats } from '@/lib/goalStats'
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

  // Statistiche gol (sessione tecnica): solo le partite già giocate dello stesso torneo.
  // I Mondiali restano fuori dal test sui campionati italiani, e viceversa.
  const { data: stessoTorneo } = await supabase.from('schedine').select('id').eq('torneo', schedina.torneo ?? '')
  const ids = new Set(((stessoTorneo ?? []) as { id: number }[]).map(s => s.id))
  const { data: risultati } = await supabase.from('risultati').select('*')
  const ris = ((risultati as Risultato[] | null) ?? []).filter(r => ids.size === 0 || ids.has(r.schedina_id))
  const goalStats = computeGoalStats(ris)
  const teamStats = computeTeamGoalStats(ris)

  return (
    <ScedinaForm
      schedina={schedina}
      pronosticoEsistente={null}
      userId={user.id}
      goalStats={goalStats}
      teamStats={teamStats}
    />
  )
}
