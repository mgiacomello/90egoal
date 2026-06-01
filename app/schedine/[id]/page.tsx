import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ScedinaForm from '@/components/ScedinaForm'

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

  const { data: pronostico } = await supabase
    .from('pronostici')
    .select('*')
    .eq('user_id', user.id)
    .eq('schedina_id', id)
    .maybeSingle()

  return (
    <ScedinaForm
      schedina={schedina}
      pronosticoEsistente={pronostico}
      userId={user.id}
    />
  )
}
