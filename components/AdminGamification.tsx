import { Profile, ClassificaRow, ActivitySummary } from '@/lib/types'

interface Props {
  profiles: Profile[]
  classifica: ClassificaRow[]
  activity: ActivitySummary[]
}

// Premi attuali (personalizzabili: basta cambiarli qui o chiedere all'assistente)
const PREMI = [
  { pos: '🥇', label: '1° premio', testo: 'Maglia ufficiale Mondiali 2026 + 50€', col: 'rgba(255,210,74,0.16)', bd: 'rgba(255,210,74,0.5)' },
  { pos: '🥈', label: '2° premio', testo: 'Pallone ufficiale della competizione', col: 'rgba(148,163,184,0.16)', bd: 'rgba(148,163,184,0.5)' },
  { pos: '🥉', label: '3° premio', testo: 'Kit gadget 90 & Goal', col: 'rgba(180,120,60,0.16)', bd: 'rgba(180,120,60,0.5)' },
]

export default function AdminGamification({ profiles, classifica, activity }: Props) {
  const nameById = new Map(profiles.map(p => [p.id, p.username]))
  const giocatoriIds = new Set(profiles.filter(p => !p.is_admin).map(p => p.id))

  // classifica generale (somma punti su tutte le schedine)
  const tot = new Map<string, number>()
  classifica.forEach(c => tot.set(c.user_id, (tot.get(c.user_id) ?? 0) + c.totale))
  const generale = [...tot.entries()]
    .filter(([id]) => giocatoriIds.has(id))
    .map(([id, t]) => ({ id, name: nameById.get(id) ?? '—', tot: t }))
    .sort((a, b) => b.tot - a.tot)

  // badge automatici
  const sumBy = (field: 'punti_minuti') => {
    const m = new Map<string, number>()
    classifica.forEach(c => giocatoriIds.has(c.user_id) && m.set(c.user_id, (m.get(c.user_id) ?? 0) + c[field]))
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]
  }
  const cecchino = sumBy('punti_minuti')
  const veggenti = [...new Set(classifica.filter(c => c.punti_bonus >= 10 && giocatoriIds.has(c.user_id)).map(c => c.user_id))]
  const act = activity.filter(a => giocatoriIds.has(a.user_id))
  const maratoneta = [...act].sort((a, b) => (b.minuti_attivi || 0) - (a.minuti_attivi || 0))[0]
  const assiduo = [...act].sort((a, b) => (b.giorni_attivi || 0) - (a.giorni_attivi || 0))[0]

  const badges = [
    { icon: '🎯', nome: 'Cecchino', desc: 'Più minuti azzeccati in totale', who: cecchino ? nameById.get(cecchino[0]) : null, val: cecchino ? `${cecchino[1]} min` : null },
    { icon: '🔮', nome: 'Veggente', desc: 'Ha indovinato prima E ultima squadra', who: veggenti.length ? veggenti.map(id => nameById.get(id)).filter(Boolean).join(', ') : null, val: veggenti.length ? '+10' : null },
    { icon: '⏱️', nome: 'Maratoneta', desc: 'Più tempo passato in piattaforma', who: maratoneta ? nameById.get(maratoneta.user_id) : null, val: maratoneta ? `${maratoneta.minuti_attivi} min` : null },
    { icon: '🔥', nome: 'Più assiduo', desc: 'Più giorni di attività', who: assiduo ? nameById.get(assiduo.user_id) : null, val: assiduo ? `${assiduo.giorni_attivi} gg` : null },
  ]

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#ffd24a' }}>Premi</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">🎁 Premi &amp; Gamification</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Chi vince e cosa vince. Riconoscimenti automatici per rendere il gioco più coinvolgente.</p>
      </div>

      {/* Montepremi + vincitori attuali */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {PREMI.map((p, i) => {
          const w = generale[i]
          return (
            <div key={i} className="glass rounded-2xl p-5 border-gradient" style={{ background: p.col, borderColor: p.bd }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{p.pos}</span>
                <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{p.label}</span>
              </div>
              <div className="font-semibold text-white mb-3 text-sm">{p.testo}</div>
              <div className="border-t border-white/10 pt-2">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">In testa ora</div>
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">{w?.name ?? '—'}</span>
                  <span className="font-display font-extrabold text-[var(--accent-soft)] tabular-nums">{w ? `${w.tot} pt` : ''}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-[var(--muted)] mb-8">💡 I premi sono un esempio modificabile: dimmi cosa mettere in palio e li aggiorno (o creiamo una sezione per gestirli).</p>

      {/* Riconoscimenti automatici */}
      <h3 className="font-display font-bold text-lg mb-3">🏅 Riconoscimenti automatici</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {badges.map(b => (
          <div key={b.nome} className="glass rounded-2xl p-4 flex items-center gap-4">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-white/5 text-2xl shrink-0">{b.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold">{b.nome}</div>
              <div className="text-xs text-[var(--muted)]">{b.desc}</div>
            </div>
            <div className="text-right shrink-0">
              {b.who ? (
                <>
                  <div className="font-semibold text-[var(--accent-soft)] truncate max-w-[140px]">{b.who}</div>
                  {b.val && <div className="text-[11px] text-[var(--muted)]">{b.val}</div>}
                </>
              ) : <span className="text-xs text-[var(--muted)]">—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
