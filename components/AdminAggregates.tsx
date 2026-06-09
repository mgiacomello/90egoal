import { Schedina, Pronostico, Profile, Risultato, ClassificaRow } from '@/lib/types'
import Flag from '@/components/Flag'

interface Props {
  schedine: Schedina[]
  profiles: Profile[]
  pronostici: Pronostico[]
  risultatiMap: Record<number, Risultato>
  classifica: ClassificaRow[]
}

const FASCE = [
  { label: "1–15'", min: 1, max: 15 },
  { label: "16–30'", min: 16, max: 30 },
  { label: "31–45'", min: 31, max: 45 },
  { label: "46–60'", min: 46, max: 60 },
  { label: "61–75'", min: 61, max: 75 },
  { label: "76–90'", min: 76, max: 90 },
]

export default function AdminAggregates({ schedine, profiles, pronostici, risultatiMap, classifica }: Props) {
  const utentiNonAdmin = profiles.filter(p => !p.is_admin).length || profiles.length

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent-cyan)] uppercase">Analisi</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">📊 Statistiche aggregate</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Tendenze di gioco su tutti i pronostici ricevuti.</p>
      </div>

      {schedine.map(s => {
        const giocate = pronostici.filter(p => p.schedina_id === s.id)
        const n = giocate.length
        const risultato = risultatiMap[s.id]

        // distribuzione minuti
        const minuteCounts = new Array(91).fill(0) as number[]
        giocate.forEach(g => g.minuti.forEach(m => { if (m >= 1 && m <= 90) minuteCounts[m]++ }))
        const maxMinute = Math.max(1, ...minuteCounts)
        const topMinutes = minuteCounts
          .map((c, m) => ({ m, c }))
          .filter(x => x.m >= 1 && x.c > 0)
          .sort((a, b) => b.c - a.c)
          .slice(0, 8)

        // fasce
        const fasce = FASCE.map(f => ({
          ...f,
          n: giocate.reduce((acc, g) => acc + g.minuti.filter(m => m >= f.min && m <= f.max).length, 0),
        }))
        const maxFascia = Math.max(1, ...fasce.map(f => f.n))

        // recupero
        const recupero = { primo: 0, secondo: 0, nessuno: 0 }
        giocate.forEach(g => {
          if (g.recupero === 'primo') recupero.primo++
          else if (g.recupero === 'secondo') recupero.secondo++
          else recupero.nessuno++
        })

        // squadre prima/ultima
        const countTeams = (key: 'first_goal' | 'last_goal') => {
          const map = new Map<string, number>()
          giocate.forEach(g => { const t = g[key]; if (t) map.set(t, (map.get(t) ?? 0) + 1) })
          return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        }
        const topFirst = countTeams('first_goal')
        const topLast = countTeams('last_goal')

        // punteggi (se risultati)
        const punti = classifica.filter(c => c.schedina_id === s.id).map(c => c.totale)
        const mediaPunti = punti.length ? (punti.reduce((a, b) => a + b, 0) / punti.length) : 0
        const maxPunti = punti.length ? Math.max(...punti) : 0

        return (
          <section key={s.id} className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
              <h3 className="font-display font-bold text-lg">{s.nome.replace(' — Mondiali FIFA 2026', '')}</h3>
              <span className="text-sm text-[var(--muted)]">
                {n} su {utentiNonAdmin} hanno giocato{' '}
                <span className="text-[var(--accent-soft)] font-semibold">
                  ({utentiNonAdmin ? Math.round((n / utentiNonAdmin) * 100) : 0}%)
                </span>
              </span>
            </div>

            {n === 0 ? (
              <p className="text-[var(--muted)] text-sm text-center py-6">Nessuna giocata ancora: le statistiche compariranno qui.</p>
            ) : (
              <div className="space-y-7">
                {/* Istogramma minuti 1–90 */}
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Minuti più pronosticati (1–90)</p>
                  <div className="flex items-end gap-[2px] h-24">
                    {Array.from({ length: 90 }, (_, i) => i + 1).map(m => {
                      const c = minuteCounts[m]
                      const h = (c / maxMinute) * 100
                      const isTop = topMinutes.length > 0 && c === topMinutes[0].c && c > 0
                      return (
                        <div key={m} className="flex-1 flex items-end h-full" title={`${m}' · ${c} ${c === 1 ? 'giocatore' : 'giocatori'}`}>
                          <div
                            className="w-full rounded-t-[2px]"
                            style={{
                              height: `${Math.max(h, c > 0 ? 6 : 0)}%`,
                              background: isTop ? '#1aff8c' : 'rgba(0,230,118,0.45)',
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1">
                    <span>1&apos;</span><span>23&apos;</span><span>45&apos;</span><span>68&apos;</span><span>90&apos;</span>
                  </div>
                </div>

                {/* Top minuti + fasce */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Minuti più scelti</p>
                    <div className="flex flex-wrap gap-2">
                      {topMinutes.map(({ m, c }) => (
                        <span key={m} className="tag-static px-2.5 py-1 text-xs">
                          {m}&apos; <span className="opacity-70">×{c}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Distribuzione per fascia</p>
                    <div className="space-y-1.5">
                      {fasce.map(f => (
                        <div key={f.label} className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-[var(--muted)] tabular-nums shrink-0">{f.label}</span>
                          <div className="flex-1 h-3 rounded-full bg-white/6 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(f.n / maxFascia) * 100}%`, background: 'linear-gradient(90deg, rgba(0,230,118,0.7), rgba(34,211,238,0.7))' }} />
                          </div>
                          <span className="w-7 text-right text-white/70 tabular-nums">{f.n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recupero + squadre */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Recupero</p>
                    <div className="space-y-1.5 text-sm">
                      <RecRow label="1° tempo" n={recupero.primo} tot={n} />
                      <RecRow label="2° tempo" n={recupero.secondo} tot={n} />
                      <RecRow label="Nessuno" n={recupero.nessuno} tot={n} muted />
                    </div>
                  </div>

                  <TeamTop title="🥇 Prima a segnare" items={topFirst} />
                  <TeamTop title="🏁 Ultima a segnare" items={topLast} />
                </div>

                {/* Punteggi se risultati */}
                {risultato && punti.length > 0 && (
                  <div className="pt-4 border-t border-white/8 grid grid-cols-3 gap-3 text-center">
                    <Mini n={mediaPunti.toFixed(1)} l="Punteggio medio" />
                    <Mini n={maxPunti} l="Miglior punteggio" />
                    <Mini n={risultato.minuti_gol.length} l="Gol reali" />
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function RecRow({ label, n, tot, muted }: { label: string; n: number; tot: number; muted?: boolean }) {
  const pct = tot ? Math.round((n / tot) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className={`w-16 shrink-0 ${muted ? 'text-[var(--muted)]' : 'text-white'}`}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-white/6 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: muted ? 'rgba(255,255,255,0.25)' : 'rgba(255,210,74,0.8)' }} />
      </div>
      <span className="w-12 text-right text-[var(--muted)] tabular-nums text-xs">{n} · {pct}%</span>
    </div>
  )
}

function TeamTop({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nessuna scelta.</p>
      ) : (
        <div className="space-y-2">
          {items.map(([team, c]) => (
            <div key={team} className="flex items-center gap-2 text-sm">
              <Flag team={team} w={40} className="w-5 h-3.5 shrink-0" />
              <span className="text-white/85 truncate flex-1">{team}</span>
              <span className="text-[var(--accent-soft)] font-semibold tabular-nums">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Mini({ n, l }: { n: number | string; l: string }) {
  return (
    <div>
      <div className="font-display font-extrabold text-2xl text-gradient tabular-nums">{n}</div>
      <div className="text-[11px] text-[var(--muted)] mt-0.5">{l}</div>
    </div>
  )
}
