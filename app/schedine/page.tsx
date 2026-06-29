import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Schedina, Pronostico } from '@/lib/types'
import LiveRefresh from '@/components/LiveRefresh'
import SchedinaCard from '@/components/SchedinaCard'

export default async function SchedinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: schedine } = await supabase.from('schedine').select('*').order('id')
  const { data: mieiPronostici } = await supabase.from('pronostici').select('*').eq('user_id', user.id)
  const { data: risultati } = await supabase.from('risultati').select('*')

  const pronosticoMap = new Map<number, Pronostico>()
  mieiPronostici?.forEach(p => pronosticoMap.set(p.schedina_id, p))
  const risultatoMap = new Map(risultati?.map(r => [r.schedina_id, r]) ?? [])

  const now = new Date()
  const tutte = (schedine as Schedina[] | null) ?? []
  const attive = tutte.filter(s => s.attiva !== false)
  const archiviate = tutte.filter(s => s.attiva === false)

  return (
    <div className="animate-fade-up">
      <LiveRefresh seconds={60} />
      <div className="mb-8">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Le tue schedine</span>
        <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2">Compila i pronostici</h1>
        <p className="text-[var(--muted)] mt-2">Compila e invia i tuoi pronostici prima della scadenza. Una volta inviati sono <strong className="text-white">definitivi</strong>.</p>
      </div>

      {attive.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center">
          <div className="text-5xl mb-4">⚔️</div>
          <p className="text-[var(--muted)]">Nessuna schedina attiva al momento.<br />Le prossime arriveranno con la fase a eliminazione diretta.</p>
        </div>
      ) : (
        <div className="space-y-5 stagger">
          {attive.map(s => (
            <SchedinaCard key={s.id} schedina={s} pronostico={pronosticoMap.get(s.id)} risultato={risultatoMap.get(s.id)} now={now} />
          ))}
        </div>
      )}

      {/* ===== ARCHIVIO (compatto, espandibile) ===== */}
      {archiviate.length > 0 && (
        <div className="mt-12">
          <span className="text-xs font-semibold tracking-widest text-[var(--muted)] uppercase">📦 Archivio · fase a gironi</span>
          <p className="text-[var(--muted)] text-sm mt-1 mb-4">Schedine concluse. Tocca una riga per espanderla. I punti restano validi in classifica.</p>
          <div className="space-y-2">
            {archiviate.map(s => (
              <details key={s.id} className="glass rounded-xl overflow-hidden group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 select-none">
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-sm truncate">{s.nome.replace(' — Mondiali FIFA 2026', '')}</div>
                    <div className="text-xs text-[var(--muted)]">
                      Gironi · {s.partite.length} partite · conclusa{pronosticoMap.get(s.id) ? ' · ✓ giocata' : ''}
                    </div>
                  </div>
                  <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90 shrink-0">▶</span>
                </summary>
                <div className="px-1 pb-1">
                  <SchedinaCard schedina={s} pronostico={pronosticoMap.get(s.id)} risultato={risultatoMap.get(s.id)} now={now} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
