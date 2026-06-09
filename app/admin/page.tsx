import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminPanel from '@/components/AdminPanel'
import AdminStats from '@/components/AdminStats'
import { Pronostico, Profile, ClassificaRow } from '@/lib/types'

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

  const [{ data: schedine }, { data: risultati }, { data: pronostici }, { data: profiles }, { data: classifica }] = await Promise.all([
    supabase.from('schedine').select('*').order('id'),
    supabase.from('risultati').select('*'),
    supabase.from('pronostici').select('*'),
    supabase.from('profiles').select('id, username, full_name, is_admin, created_at'),
    supabase.from('classifica').select('*'),
  ])

  const pronosticiBySched = new Map<number, number>()
  ;(pronostici as Pronostico[] | null)?.forEach(p => {
    pronosticiBySched.set(p.schedina_id, (pronosticiBySched.get(p.schedina_id) ?? 0) + 1)
  })

  const risultatiMap = new Map(risultati?.map(r => [r.schedina_id, r]) ?? [])

  return (
    <div className="space-y-12">
      <AdminPanel
        schedine={schedine ?? []}
        risultatiMap={Object.fromEntries(risultatiMap)}
        pronosticiBySched={Object.fromEntries(pronosticiBySched)}
      />

      <AdminStats
        schedine={schedine ?? []}
        profiles={(profiles as Profile[]) ?? []}
        pronostici={(pronostici as Pronostico[]) ?? []}
        risultatiMap={Object.fromEntries(risultatiMap)}
        classifica={(classifica as ClassificaRow[]) ?? []}
      />
    </div>
  )
}
