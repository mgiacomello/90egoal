import { Profile, ActivitySummary } from '@/lib/types'

interface Props {
  profiles: Profile[]
  activity: ActivitySummary[]
}

export default function AdminSignups({ profiles, activity }: Props) {
  const giocatori = profiles.filter(p => !p.is_admin)
  const ids = new Set(giocatori.map(p => p.id))

  // registrazioni per giorno
  const perDay = new Map<string, number>()
  giocatori.forEach(p => {
    if (!p.created_at) return
    const d = new Date(p.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' })
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
  })
  // ordina per data reale
  const giorni = [...perDay.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => {
      const [da, ma] = a.label.split('/').map(Number); const [db, mb] = b.label.split('/').map(Number)
      return (ma - mb) || (da - db)
    })
  const maxDay = Math.max(1, ...giorni.map(g => g.n))

  // retention
  const act = activity.filter(a => ids.has(a.user_id))
  const tornati = act.filter(a => (a.giorni_attivi || 0) >= 2).length
  const unGiorno = act.filter(a => (a.giorni_attivi || 0) <= 1).length
  const senzaAttivita = giocatori.length - act.length
  const mediaGiorni = act.length ? (act.reduce((s, a) => s + (a.giorni_attivi || 0), 0) / act.length) : 0
  const retPct = giocatori.length ? Math.round((tornati / giocatori.length) * 100) : 0

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#22d3ee' }}>Crescita</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">📊 Registrazioni &amp; ritorni</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Quanti si iscrivono ogni giorno e quanti tornano a giocare.</p>
      </div>

      {/* Registrazioni nel tempo */}
      <div className="glass rounded-2xl p-6 mb-4">
        <h3 className="font-display font-bold text-lg mb-4">Iscrizioni per giorno</h3>
        {giorni.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">Nessun dato.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {giorni.map(g => (
              <div key={g.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${g.label}: ${g.n} iscritti`}>
                <span className="text-[10px] text-white/70 font-semibold tabular-nums">{g.n}</span>
                <div className="w-full rounded-t-md" style={{ height: `${(g.n / maxDay) * 100}%`, minHeight: 4, background: 'linear-gradient(to top, rgba(0,230,118,0.8), rgba(34,211,238,0.6))' }} />
                <span className="text-[9px] text-[var(--muted)] whitespace-nowrap">{g.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retention */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card n={`${retPct}%`} l="Tasso di ritorno (≥2 giorni)" hot />
        <Card n={tornati} l="Tornati a giocare" />
        <Card n={unGiorno} l="Visti 1 solo giorno" />
        <Card n={mediaGiorni.toFixed(1)} l="Giorni attivi medi" />
      </div>
      {senzaAttivita > 0 && <p className="text-xs text-[var(--muted)] mt-2">{senzaAttivita} iscritti senza attività tracciata.</p>}
    </div>
  )
}

function Card({ n, l, hot }: { n: number | string; l: string; hot?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className={`font-display font-extrabold text-2xl tabular-nums ${hot ? 'text-[var(--accent-cyan)]' : 'text-white'}`}>{n}</div>
      <div className="text-[11px] text-[var(--muted)] mt-1 leading-tight">{l}</div>
    </div>
  )
}
