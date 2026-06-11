import { TimingSummary, SectionTime } from '@/lib/types'

interface Props {
  timing: TimingSummary[]
  sections: SectionTime[]
}

// Etichette leggibili per ogni tappa tracciata
const LABELS: Record<string, { label: string; icon: string }> = {
  register: { label: 'Registrazione account', icon: '📝' },
  minutes_done: { label: 'Inserire tutti i 13 minuti', icon: '🕐' },
  recupero_set: { label: 'Scegliere il recupero (1°/2° tempo)', icon: '➕' },
  first_team_set: { label: 'Scegliere la prima squadra a segnare', icon: '🥇' },
  last_team_set: { label: 'Scegliere l’ultima squadra a segnare', icon: '🏁' },
  submit: { label: 'Completare e inviare la schedina', icon: '🔒' },
}
const ORDER = ['register', 'minutes_done', 'recupero_set', 'first_team_set', 'last_team_set', 'submit']

function fmtSec(s: number): string {
  if (s == null) return '—'
  const total = Math.round(s)
  if (total < 60) return `${total} s`
  const m = Math.floor(total / 60)
  const r = total % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

export default function AdminTiming({ timing, sections }: Props) {
  const byEvent = new Map(timing.map(t => [t.event, t]))
  const rows = ORDER.filter(e => byEvent.has(e)).map(e => ({ key: e, ...LABELS[e], t: byEvent.get(e)! }))
  const maxSezione = Math.max(1, ...sections.map(s => s.minuti_totali))
  const sezioniOrdinate = [...sections].sort((a, b) => b.minuti_totali - a.minuti_totali)

  const hasData = timing.length > 0 || sections.length > 0

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#a78bfa' }}>Comportamento</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">⏱️ Tempi degli utenti</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Quanto tempo impiegano nelle varie fasi e sezioni del sito.</p>
      </div>

      {!hasData ? (
        <div className="glass rounded-2xl p-6 text-center text-[var(--muted)] text-sm">
          I dati sui tempi compariranno man mano che gli utenti navigano e compilano (richiede la migrazione attiva).
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tempi per fase */}
          {rows.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-1">Tempo medio per fase</h3>
              <p className="text-xs text-[var(--muted)] mb-4">Dall’apertura della schedina (o inizio registrazione) a ciascuna scelta.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-[var(--muted)] text-xs uppercase tracking-wider border-b border-white/8">
                      <th className="text-left px-3 py-2">Fase</th>
                      <th className="text-center px-3 py-2">Media</th>
                      <th className="text-center px-3 py-2">Mediana</th>
                      <th className="text-center px-3 py-2">Min</th>
                      <th className="text-center px-3 py-2">Max</th>
                      <th className="text-center px-3 py-2">Campioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.key} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-3"><span className="mr-1.5">{r.icon}</span>{r.label}</td>
                        <td className="px-3 py-3 text-center font-display font-bold text-[var(--accent-soft)]">{fmtSec(r.t.media_sec)}</td>
                        <td className="px-3 py-3 text-center text-white/70">{fmtSec(r.t.mediana_sec)}</td>
                        <td className="px-3 py-3 text-center text-white/50">{fmtSec(r.t.min_sec)}</td>
                        <td className="px-3 py-3 text-center text-white/50">{fmtSec(r.t.max_sec)}</td>
                        <td className="px-3 py-3 text-center text-[var(--muted)] tabular-nums">{r.t.campioni}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Permanenza per sezione */}
          {sezioniOrdinate.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-1">Permanenza per sezione</h3>
              <p className="text-xs text-[var(--muted)] mb-4">Tempo totale trascorso dagli utenti in ogni parte del sito (≈ minuti).</p>
              <div className="space-y-2.5">
                {sezioniOrdinate.map(s => (
                  <div key={s.sezione} className="flex items-center gap-3 text-sm">
                    <span className="w-44 shrink-0 truncate">{s.sezione}</span>
                    <div className="flex-1 h-3 rounded-full bg-white/6 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.minuti_totali / maxSezione) * 100}%`, background: 'linear-gradient(90deg, rgba(139,92,246,0.8), rgba(34,211,238,0.8))' }} />
                    </div>
                    <span className="w-24 text-right text-white/70 tabular-nums">{s.minuti_totali} min · {s.utenti}👤</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
