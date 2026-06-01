import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminPanel from '@/components/AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  const { data: schedine } = await supabase.from('schedine').select('*').order('id')
  const { data: risultati } = await supabase.from('risultati').select('*')
  const { data: stats } = await supabase.from('pronostici').select('schedina_id, user_id')

  const pronosticiBySched = new Map<number, number>()
  stats?.forEach(p => {
    pronosticiBySched.set(p.schedina_id, (pronosticiBySched.get(p.schedina_id) ?? 0) + 1)
  })

  const risultatiMap = new Map(risultati?.map(r => [r.schedina_id, r]) ?? [])

  return (
    <AdminPanel
      schedine={schedine ?? []}
      risultatiMap={Object.fromEntries(risultatiMap)}
      pronosticiBySched={Object.fromEntries(pronosticiBySched)}
    />
  )
}
