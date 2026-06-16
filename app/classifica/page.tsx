import { createClient } from '@/lib/supabase/server'
import { ClassificaRow } from '@/lib/types'

interface GeneraleRow { user_id: string; username: string; full_name: string; totale: number; pos: number }

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#1aff8c,#22d3ee)',
  'linear-gradient(135deg,#22d3ee,#8b5cf6)',
  'linear-gradient(135deg,#ffd24a,#ff9f43)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#34d399,#3b82f6)',
  'linear-gradient(135deg,#f472b6,#fb7185)',
]
function avatarFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

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
        <span className="text-xs font-semibold tracking-widest text-[var(--gold)] uppercase">Leaderboard</span>
        <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2">🏆 Classifica</h1>
      </div>

      {generale.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center">
          <div className="text-5xl mb-4 animate-float inline-block">⏳</div>
          <p className="text-[var(--muted)]">Le classifiche saranno disponibili<br />dopo la pubblicazione dei risultati.</p>
        </div>
      ) : (
        <>
          {generale.length >= 3 && <Podium top3={generale.slice(0, 3)} currentUserId={user?.id} />}

          <section className="mb-10">
            <h2 className="font-display font-bold text-lg mb-3 text-[var(--gold)]">Classifica Generale</h2>
            <LeaderList rows={generale.map(g => ({ ...g, key: g.user_id }))} maxTot={generale[0]?.totale ?? 1} currentUserId={user?.id} />
          </section>

          {schedine?.map(s => {
            const rows = (bySchedina.get(s.id) ?? []).sort((a, b) => b.totale - a.totale).map((r, i) => ({ ...r, pos: i + 1 }))
            return (
              <section key={s.id} className="mb-8">
                <h2 className="font-display font-semibold text-base mb-3 text-white/80">{s.nome.replace(' — Mondiali FIFA 2026', '')}</h2>
                {rows.length === 0 ? (
                  <div className="glass rounded-2xl p-6 text-center text-[var(--muted)] text-sm">Risultati non ancora pubblicati.</div>
                ) : (
                  <LeaderList
                    rows={rows.map(r => ({ key: r.user_id, user_id: r.user_id, username: r.username, full_name: r.full_name, totale: r.totale, pos: r.pos, detail: r }))}
                    maxTot={rows[0]?.totale ?? 1}
                    currentUserId={user?.id}
                  />
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
  const heights = ['h-20', 'h-32', 'h-16']
  const medals = ['🥈', '🥇', '🥉']
  const ranks = [2, 1, 3]
  const delays = ['0.15s', '0s', '0.3s']
  const colCol = [
    'linear-gradient(to top, rgba(148,163,184,0.18), rgba(148,163,184,0.02))',
    'linear-gradient(to top, rgba(255,210,74,0.3), rgba(255,210,74,0.04))',
    'linear-gradient(to top, rgba(180,120,60,0.2), rgba(180,120,60,0.03))',
  ]

  return (
    <div className="glass rounded-2xl p-6 pt-8 mb-8 overflow-hidden relative">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-[var(--gold)]/10 blur-3xl rounded-full pointer-events-none" />
      <div className="relative flex items-end justify-center gap-3 sm:gap-5">
        {order.map((r, i) => {
          const isMe = r.user_id === currentUserId
          const isFirst = ranks[i] === 1
          return (
            <div key={r.user_id} className="flex flex-col items-center flex-1 max-w-[140px]">
              <div className="podium-medal text-3xl sm:text-4xl mb-1" style={{ animationDelay: delays[i] }}>{medals[i]}</div>
              <div
                className="grid place-items-center w-11 h-11 rounded-full text-sm font-extrabold text-[#04130b] mb-2 ring-2 ring-white/15 podium-medal"
                style={{ background: avatarFor(r.username), animationDelay: delays[i] }}
              >
                {r.username.slice(0, 1).toUpperCase()}
              </div>
              <div className={`font-semibold text-sm text-center truncate w-full ${isMe ? 'text-[var(--accent-soft)]' : 'text-white'}`}>
                {r.username}{isMe && ' (tu)'}
              </div>
              <div className="font-display font-extrabold text-2xl text-gradient-gold tabular-nums">{r.totale}<span className="text-xs text-[var(--muted)] font-normal ml-0.5">pt</span></div>
              <div
                className={`podium-col mt-2 w-full ${heights[i]} rounded-t-xl border border-white/10 border-b-0 grid place-items-start justify-center pt-2 ${isFirst ? 'is-leader' : ''}`}
                style={{ background: colCol[i], animationDelay: delays[i] }}
              >
                <span className="font-display font-extrabold text-xl text-white/40">{ranks[i]}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ListRow {
  key: string
  user_id?: string
  username: string
  full_name: string
  totale: number
  pos: number
  detail?: ClassificaRow
}

function LeaderList({ rows, maxTot, currentUserId }: { rows: ListRow[]; maxTot: number; currentUserId?: string }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="space-y-2">
      {rows.map((r, idx) => {
        const isMe = r.user_id && r.user_id === currentUserId
        const pct = maxTot > 0 ? Math.max((r.totale / maxTot) * 100, 4) : 0
        const azzeccati = r.detail?.minuti_azzeccati ?? []
        return (
          <div
            key={r.key}
            className={`leader-row glass rounded-xl px-3 py-2.5 ${isMe ? 'is-leader' : 'glass-hover'}`}
            style={{ animationDelay: `${Math.min(idx * 0.04, 0.7)}s` }}
          >
            <div className="flex items-center gap-3">
              {/* rank */}
              <div className="w-8 shrink-0 text-center">
                {r.pos <= 3 ? <span className="text-xl">{medals[r.pos - 1]}</span> : <span className="text-[var(--muted)] font-bold tabular-nums">{r.pos}</span>}
              </div>
              {/* avatar */}
              <div className="grid place-items-center w-9 h-9 rounded-full text-xs font-extrabold text-[#04130b] shrink-0 ring-1 ring-white/15" style={{ background: avatarFor(r.username) }}>
                {r.username.slice(0, 1).toUpperCase()}
              </div>
              {/* name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`font-semibold truncate ${isMe ? 'text-[var(--accent-soft)]' : 'text-white'}`}>{r.username}</span>
                  {isMe && <span className="text-[var(--accent)] text-[10px] font-bold">TU</span>}
                  {r.full_name && <span className="text-[var(--muted)] text-xs hidden sm:inline truncate">· {r.full_name}</span>}
                </div>
                <div className="h-1.5 mt-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="points-bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent-soft), var(--accent-cyan))', animationDelay: `${Math.min(idx * 0.04, 0.7) + 0.1}s` }} />
                </div>
              </div>
              {/* total */}
              <div className="shrink-0 text-right">
                <span className="font-display font-extrabold text-lg text-[var(--accent-soft)] tabular-nums">{r.totale}</span>
                <span className="text-[10px] text-[var(--muted)] ml-0.5">pt</span>
              </div>
            </div>

            {/* dettaglio per-schedina: punti + minuti azzeccati */}
            {r.detail && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 pl-[4.75rem] text-xs">
                <span className="text-[var(--muted)]">
                  {r.detail.punti_minuti} min · {r.detail.punti_recupero} rec · {r.detail.punti_bonus} bonus
                </span>
                {azzeccati.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-[var(--muted)]">⚽</span>
                    {azzeccati.map(m => (
                      <span key={m} className="tag-static px-1.5 py-0.5 text-[10px]">{m}&apos;</span>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
