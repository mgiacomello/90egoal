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

      {/* ===== ARCHIVIO ===== */}
      {archiviate.length > 0 && (
        <details className="mt-12 group">
          <summary className="cursor-pointer list-none flex items-center gap-2 mb-1 select-none">
            <span className="text-xs font-semibold tracking-widest text-[var(--muted)] uppercase">📦 Archivio · fase a gironi</span>
            <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90">▶</span>
          </summary>
          <p className="text-[var(--muted)] text-sm mb-5">Le schedine concluse dei gironi. I punti restano validi in classifica.</p>
          <div className="space-y-5">
            {archiviate.map(s => (
              <SchedinaCard key={s.id} schedina={s} pronostico={pronosticoMap.get(s.id)} risultato={risultatoMap.get(s.id)} now={now} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
