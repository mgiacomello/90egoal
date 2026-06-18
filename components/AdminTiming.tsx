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
              <h3 className="font-display font-bold text-lg mb-1">Quanto tempo ci mettono</h3>
              <p className="text-xs text-[var(--muted)] mb-4">Tempo dall’apertura della schedina (o inizio registrazione) a ciascuna scelta.</p>

              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.key} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3">
                    <span className="text-lg shrink-0">{r.icon}</span>
                    <span className="flex-1 min-w-0 text-sm">{r.label}</span>
                    <div className="text-right shrink-0">
                      <div className="font-display font-extrabold text-[var(--accent-soft)] text-lg leading-none">{fmtSec(r.t.mediana_sec)}</div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">di solito · media {fmtSec(r.t.media_sec)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-[var(--accent)]/[0.06] border border-[var(--accent)]/20 px-4 py-3 text-xs text-[var(--muted)] leading-relaxed">
                💡 <strong className="text-white">&quot;Di solito&quot;</strong> (mediana) = il tempo della persona &quot;di mezzo&quot;: metà sono più veloci, metà più lente. È il dato più realistico.
                La <strong className="text-white/80">media</strong> invece può essere gonfiata da poche persone che lasciano la pagina aperta a lungo, quindi è meno indicativa.
              </div>
            </div>
          )}

          {/* Permanenza per sezione */}
          {sezioniOrdinate.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-1">Permanenza per sezione</h3>
              <p className="text-xs text-[var(--muted)] mb-4">Tempo totale dei giocatori in ogni parte del sito (≈ minuti, solo da loggati).</p>
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
