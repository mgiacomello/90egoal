import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminPanel from '@/components/AdminPanel'
import AdminAggregates from '@/components/AdminAggregates'
import AdminStats from '@/components/AdminStats'
import AdminUsers from '@/components/AdminUsers'
import AdminUserSearch from '@/components/AdminUserSearch'
import AdminSignups from '@/components/AdminSignups'
import AdminPredictions from '@/components/AdminPredictions'
import AdminGamification from '@/components/AdminGamification'
import AdminTiming from '@/components/AdminTiming'
import AdminLive from '@/components/AdminLive'
import AdminSchedine from '@/components/AdminSchedine'
import { Pronostico, Profile, ClassificaRow, ActivitySummary, TimingSummary, SectionTime, Schedina } from '@/lib/types'

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

  const [{ data: schedine }, { data: risultati }, { data: pronostici }, { data: classifica }] = await Promise.all([
    supabase.from('schedine').select('*').order('id'),
    supabase.from('risultati').select('*'),
    supabase.from('pronostici').select('*'),
    supabase.from('classifica').select('*'),
  ])

  // Profili: prima i campi base (sempre disponibili), poi prova email (post-migrazione)
  const { data: profilesBase } = await supabase
    .from('profiles')
    .select('id, username, full_name, is_admin, created_at')
  let profiles = profilesBase as Profile[] | null
  const { data: emailRows } = await supabase.from('profiles').select('id, email')
  if (profiles && emailRows) {
    const emailById = new Map((emailRows as { id: string; email: string | null }[]).map(e => [e.id, e.email]))
    profiles = profiles.map(p => ({ ...p, email: emailById.get(p.id) ?? null }))
  }

  // Attività + tempi (esistono solo dopo le migrazioni): se assenti, restano vuoti
  const { data: activity } = await supabase.from('user_activity_summary').select('*')
  const { data: timing } = await supabase.from('timing_summary').select('*')
  const { data: sections } = await supabase.from('section_time').select('*')

  const pronosticiBySched = new Map<number, number>()
  ;(pronostici as Pronostico[] | null)?.forEach(p => {
    pronosticiBySched.set(p.schedina_id, (pronosticiBySched.get(p.schedina_id) ?? 0) + 1)
  })

  const risultatiMap = new Map(risultati?.map(r => [r.schedina_id, r]) ?? [])

  return (
    <div className="space-y-12">
      {/* LIVE — il giorno delle partite si lavora da qui */}
      <details open className="glass rounded-2xl overflow-hidden group">
        <summary className="cursor-pointer select-none list-none px-6 py-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
          <span className="font-display font-bold text-lg flex items-center gap-2">⚡ Live · inserimento gol</span>
          <span className="text-[var(--muted)] text-sm group-open:hidden">Apri ▾</span>
          <span className="text-[var(--muted)] text-sm hidden group-open:inline">Chiudi ▴</span>
        </summary>
        <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-white/8">
          <AdminLive schedine={(schedine as Schedina[]) ?? []} risultatiMap={Object.fromEntries(risultatiMap)} />
        </div>
      </details>

      {/* SCHEDINE — creazione e modifica */}
      <details className="glass rounded-2xl overflow-hidden group">
        <summary className="cursor-pointer select-none list-none px-6 py-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
          <span className="font-display font-bold text-lg flex items-center gap-2">🗓️ Gestione schedine</span>
          <span className="text-[var(--muted)] text-sm group-open:hidden">Apri ▾</span>
          <span className="text-[var(--muted)] text-sm hidden group-open:inline">Chiudi ▴</span>
        </summary>
        <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-white/8">
          <AdminSchedine schedine={(schedine as Schedina[]) ?? []} pronosticiBySched={Object.fromEntries(pronosticiBySched)} />
        </div>
      </details>

      {/* UTENTI — chi si è registrato, dati e permanenza */}
      <AdminUsers
        profiles={(profiles as Profile[]) ?? []}
        pronostici={(pronostici as Pronostico[]) ?? []}
        activity={(activity as ActivitySummary[]) ?? []}
        schedine={schedine ?? []}
      />

      {/* TEMPI / COMPORTAMENTO */}
      <AdminTiming
        timing={(timing as TimingSummary[]) ?? []}
        sections={(sections as SectionTime[]) ?? []}
      />

      {/* DATI & ANALISI — in primo piano */}
      <AdminAggregates
        schedine={schedine ?? []}
        profiles={(profiles as Profile[]) ?? []}
        pronostici={(pronostici as Pronostico[]) ?? []}
        risultatiMap={Object.fromEntries(risultatiMap)}
        classifica={(classifica as ClassificaRow[]) ?? []}
      />

      {/* CRESCITA — registrazioni e ritorni */}
      <AdminSignups
        profiles={(profiles as Profile[]) ?? []}
        activity={(activity as ActivitySummary[]) ?? []}
      />

      {/* PREMI & GAMIFICATION */}
      <AdminGamification
        profiles={(profiles as Profile[]) ?? []}
        classifica={(classifica as ClassificaRow[]) ?? []}
        activity={(activity as ActivitySummary[]) ?? []}
      />

      {/* PREVISIONI */}
      <AdminPredictions
        schedine={schedine ?? []}
        risultatiMap={Object.fromEntries(risultatiMap)}
        classifica={(classifica as ClassificaRow[]) ?? []}
      />

      <AdminStats
        schedine={schedine ?? []}
        profiles={(profiles as Profile[]) ?? []}
        pronostici={(pronostici as Pronostico[]) ?? []}
      />

      {/* RICERCA GIOCATORE — apri le scommesse di un singolo utente */}
      <AdminUserSearch
        schedine={schedine ?? []}
        profiles={(profiles as Profile[]) ?? []}
        pronostici={(pronostici as Pronostico[]) ?? []}
        classifica={(classifica as ClassificaRow[]) ?? []}
      />

      {/* INSERIMENTO RISULTATI — in fondo, richiudibile */}
      <details className="glass rounded-2xl overflow-hidden group">
        <summary className="cursor-pointer select-none list-none px-6 py-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
          <span className="font-display font-bold text-lg flex items-center gap-2">
            🛠️ Correzione manuale risultati
            <span className="text-xs font-normal text-[var(--muted)]">(riepilogo senza dettaglio partite)</span>
          </span>
          <span className="text-[var(--muted)] text-sm group-open:hidden">Apri ▾</span>
          <span className="text-[var(--muted)] text-sm hidden group-open:inline">Chiudi ▴</span>
        </summary>
        <div className="px-6 pb-6 pt-2 border-t border-white/8">
          <AdminPanel
            schedine={schedine ?? []}
            risultatiMap={Object.fromEntries(risultatiMap)}
            pronosticiBySched={Object.fromEntries(pronosticiBySched)}
            embedded
          />
        </div>
      </details>
    </div>
  )
}
