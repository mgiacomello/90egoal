import { createClient } from '@/lib/supabase/server'
import { ClassificaRow } from '@/lib/types'

interface GeneraleRow { user_id: string; username: string; full_name: string; totale: number; pos: number }
type TableRow = (ClassificaRow & { pos: number }) | GeneraleRow

export default async function ClassificaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: schedine } = await supabase.from('schedine').select('id, nome').order('id')
  const { data: classifica } = await supabase.from('classifica').select('*')

  const bySchedina = new Map<number, ClassificaRow[]>()
  classifica?.forEach((r: ClassificaRow) => {
    const arr = bySchedina.get(r.schedina_id) ?? []
    arr.push(r)
    bySchedina.set(r.schedina_id, arr)
  })

  const generalMap = new Map<string, GeneraleRow>()
  classifica?.forEach((r: ClassificaRow) => {
    const e = generalMap.get(r.user_id)
    if (e) e.totale += r.totale
    else generalMap.set(r.user_id, { user_id: r.user_id, username: r.username, full_name: r.full_name, totale: r.totale, pos: 0 })
  })
  const generale = [...generalMap.values()].sort((a, b) => b.totale - a.totale).map((r, i) => ({ ...r, pos: i + 1 }))

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Leaderboard</span>
        <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2">🏆 Classifica</h1>
      </div>

      {generale.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4 animate-float inline-block">⏳</div>
          <p className="text-[var(--muted)]">Le classifiche saranno disponibili<br />dopo la pubblicazione dei risultati.</p>
        </div>
      ) : (
        <>
          {/* Podio */}
          {generale.length >= 3 && <Podium top3={generale.slice(0, 3)} currentUserId={user?.id} />}

          {/* Classifica generale */}
          <section className="mb-10">
            <h2 className="font-display font-bold text-lg mb-3 text-[var(--gold)]">Classifica Generale</h2>
            <ClassificaTable rows={generale} general currentUserId={user?.id} />
          </section>

          {/* Per schedina */}
          {schedine?.map(s => {
            const rows = (bySchedina.get(s.id) ?? []).sort((a, b) => b.totale - a.totale).map((r, i) => ({ ...r, pos: i + 1 }))
            return (
              <section key={s.id} className="mb-8">
                <h2 className="font-display font-semibold text-base mb-3 text-white/80">{s.nome.replace(' — Mondiali FIFA 2026', '')}</h2>
                {rows.length === 0 ? (
                  <div className="glass rounded-2xl p-6 text-center text-[var(--muted)] text-sm">Risultati non ancora pubblicati.</div>
                ) : (
                  <ClassificaTable rows={rows} currentUserId={user?.id} />
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function Podium({ top3, currentUserId }: { top3: GeneraleRow[]; currentUserId?: string }) {
  const order = [top3[1], top3[0], top3[2]] // 2°, 1°, 3°
  const heights = ['h-24', 'h-32', 'h-20']
  const medals = ['🥈', '🥇', '🥉']
  const colors = ['from-slate-400/20 to-slate-500/5', 'from-[var(--gold)]/25 to-[var(--gold)]/5', 'from-amber-700/20 to-amber-800/5']

  return (
    <div className="glass rounded-2xl p-6 mb-8">
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        {order.map((r, i) => {
          const isMe = r.user_id === currentUserId
          return (
            <div key={r.user_id} className="flex flex-col items-center flex-1 max-w-[140px]">
              <div className="text-3xl mb-2">{medals[i]}</div>
              <div className={`font-semibold text-sm text-center truncate w-full ${isMe ? 'text-[var(--accent-soft)]' : 'text-white'}`}>
                {r.username}{isMe && ' (tu)'}
              </div>
              <div className="font-display font-extrabold text-2xl text-gradient-gold tabular-nums">{r.totale}</div>
              <div className={`mt-2 w-full ${heights[i]} rounded-t-xl bg-gradient-to-t ${colors[i]} border border-white/10 border-b-0 grid place-items-start justify-center pt-2`}>
                <span className="font-display font-extrabold text-xl text-white/40">{i === 1 ? 1 : i === 0 ? 2 : 3}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClassificaTable({ rows, general = false, currentUserId }: { rows: TableRow[]; general?: boolean; currentUserId?: string }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--muted)] text-xs uppercase tracking-wider border-b border-white/8">
            <th className="text-left px-4 py-3 w-12">#</th>
            <th className="text-left px-4 py-3">Giocatore</th>
            {!general && <th className="text-center px-2 py-3">Min</th>}
            {!general && <th className="text-center px-2 py-3">Rec</th>}
            {!general && <th className="text-center px-2 py-3">Bonus</th>}
            <th className="text-center px-4 py-3 text-white font-bold">Tot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const full = r as ClassificaRow & { pos: number }
            const isMe = 'user_id' in r && r.user_id === currentUserId
            const key = 'user_id' in r ? r.user_id : idx
            return (
              <tr key={String(key)} className={`border-b border-white/5 last:border-0 transition-colors ${isMe ? 'bg-[var(--accent)]/8' : 'hover:bg-white/[0.03]'}`}>
                <td className="px-4 py-3 text-center">
                  {r.pos <= 3 ? <span className="text-lg">{medals[r.pos - 1]}</span> : <span className="text-[var(--muted)] font-medium tabular-nums">{r.pos}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${isMe ? 'text-[var(--accent-soft)]' : 'text-white'}`}>{r.username}</span>
                  {isMe && <span className="text-[var(--accent)] text-xs ml-1.5">(tu)</span>}
                  {r.full_name && <span className="text-[var(--muted)] ml-2 text-xs hidden sm:inline">{r.full_name}</span>}
                </td>
                {!general && <td className="px-2 py-3 text-center text-white/70 tabular-nums">{full.punti_minuti}</td>}
                {!general && <td className="px-2 py-3 text-center text-white/70 tabular-nums">{full.punti_recupero}</td>}
                {!general && <td className="px-2 py-3 text-center text-white/70 tabular-nums">{full.punti_bonus}</td>}
                <td className="px-4 py-3 text-center font-display font-extrabold text-[var(--accent-soft)] tabular-nums">{r.totale}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
