import { GoalStats, TeamGoalStats } from '@/lib/goalStats'
import Flag from '@/components/Flag'

export default function GoalStatsPanel({ stats, teamStats }: { stats: GoalStats; teamStats?: TeamGoalStats[] }) {
  if (stats.totalGoals === 0) return null
  const maxBand = Math.max(1, ...stats.bands.map(b => b.count))

  return (
    <details className="glass rounded-2xl overflow-hidden group mb-2">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-5 select-none">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <span className="text-base">💡</span> Sessione tecnica
            <span className="text-xs font-normal text-[var(--muted)]">· dove arrivano i gol</span>
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {stats.totalGoals} gol in {stats.matches} partite · media {stats.avgPerMatch} a match
          </p>
        </div>
        <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90 shrink-0">▶</span>
      </summary>

      <div className="px-5 pb-5 -mt-1">
        {stats.hottest && (
          <p className="text-sm text-white/80 mb-4">
            🔥 Fascia più calda: <strong className="text-[var(--accent-soft)]">{stats.hottest.label}</strong> ({stats.hottest.pct}% dei gol)
          </p>
        )}

        {/* Distribuzione per fasce */}
        <div className="space-y-2 mb-5">
          {stats.bands.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted)] w-12 shrink-0 tabular-nums">{b.label}</span>
              <div className="flex-1 h-3 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(b.count / maxBand) * 100}%`,
                    minWidth: b.count > 0 ? 6 : 0,
                    background: 'linear-gradient(to right, var(--accent-soft), var(--accent-cyan))',
                  }}
                />
              </div>
              <span className="text-xs text-white/70 w-10 text-right tabular-nums shrink-0">{b.pct}%</span>
            </div>
          ))}
        </div>

        {/* Recupero + minuti caldi */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3">
            <div className="text-xs text-[var(--muted)] mb-1">➕ Gol nel recupero</div>
            <div className="text-sm text-white/85">
              <strong className="text-[var(--gold)]">{stats.recuperoPct}%</strong> del totale
              <span className="text-[var(--muted)]"> · 1°T: {stats.recupero1} · 2°T: {stats.recupero2}</span>
            </div>
          </div>
          {stats.topMinutes.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3">
              <div className="text-xs text-[var(--muted)] mb-1.5">⚽ Minuti più frequenti</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.topMinutes.map(t => (
                  <span key={t.m} className="text-[11px] font-mono bg-white/8 text-white/80 px-1.5 py-0.5 rounded">
                    {t.m}&apos; <span className="text-[var(--muted)]">×{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Per squadra (quando disponibile il marcatore per gol) */}
        {teamStats && teamStats.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Quando segnano le squadre</div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {teamStats.slice(0, 12).map(t => (
                <div key={t.team} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2 text-sm">
                  <Flag team={t.team} w={40} className="w-5 h-3.5 shrink-0" />
                  <span className="font-medium truncate">{t.team}</span>
                  <span className="text-[var(--muted)] text-xs ml-auto shrink-0">
                    {t.count} gol{t.hottest ? ` · ${t.hottest}` : ''}{t.recupero ? ` · +${t.recupero} rec.` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-[var(--muted)] mt-4 leading-relaxed">
          Dati dalle partite già giocate del torneo. Ti aiutano a orientarti, ma il bello del gioco resta la sorpresa. ⚽
        </p>
      </div>
    </details>
  )
}
