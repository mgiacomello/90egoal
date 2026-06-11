'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Schedina, Pronostico, Partita } from '@/lib/types'
import Flag from '@/components/Flag'
import TeamPicker from '@/components/TeamPicker'
import { stadiumImage } from '@/lib/stadiums'

const MAX_MINUTI = 13

interface Props {
  schedina: Schedina
  pronosticoEsistente: Pronostico | null
  userId: string
}

export default function ScedinaForm({ schedina, pronosticoEsistente, userId }: Props) {
  const router = useRouter()

  const [minuti, setMinuti] = useState<number[]>(pronosticoEsistente?.minuti ?? [])
  const [recupero, setRecupero] = useState<'primo' | 'secondo' | null>(pronosticoEsistente?.recupero ?? null)
  const [firstGoal, setFirstGoal] = useState<string>(pronosticoEsistente?.first_goal ?? '')
  const [lastGoal, setLastGoal] = useState<string>(pronosticoEsistente?.last_goal ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleMinuto(m: number) {
    setError('')
    if (minuti.includes(m)) {
      setMinuti(prev => prev.filter(x => x !== m))
    } else {
      if (minuti.length >= MAX_MINUTI) { setError(`Hai già scelto tutti i ${MAX_MINUTI} minuti. Deseleziona un minuto per cambiarlo.`); return }
      setMinuti(prev => [...prev, m].sort((a, b) => a - b))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (minuti.length !== MAX_MINUTI) {
      setError(`Devi inserire esattamente ${MAX_MINUTI} minuti. Ne hai inseriti ${minuti.length}.`)
      return
    }

    // Conferma: il pronostico è definitivo
    if (!window.confirm('Confermi l\'invio? Una volta inviato, il pronostico NON sarà più modificabile.')) {
      return
    }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      user_id: userId,
      schedina_id: schedina.id,
      minuti,
      recupero: recupero ?? null,
      first_goal: firstGoal || null,
      last_goal: lastGoal || null,
    }

    const { error: dbError } = await supabase.from('pronostici').insert(payload)

    if (dbError) setError('Errore nell\'invio. Riprova.')
    else {
      setSaved(true)
      setTimeout(() => router.push('/schedine'), 1800)
    }
    setSaving(false)
  }

  if (saved) {
    return (
      <div className="text-center py-24 animate-fade-up">
        <div className="inline-grid place-items-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-4xl mb-5 shadow-[0_20px_50px_-10px_rgba(0,230,118,0.6)]">✓</div>
        <h2 className="font-display font-bold text-2xl text-gradient">Pronostico inviato!</h2>
        <p className="text-[var(--muted)] mt-2">Il pronostico è <strong className="text-white">definitivo</strong> e non è più modificabile. In bocca al lupo! 🍀</p>
      </div>
    )
  }

  const progress = (minuti.length / MAX_MINUTI) * 100
  const completo = minuti.length === MAX_MINUTI

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      {/* Header con banner stadio */}
      <div className="relative rounded-2xl overflow-hidden glass mb-6">
        <div className="relative h-44 sm:h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stadiumImage(schedina.id)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/55 to-[#0d1117]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/80 to-transparent" />

          <button onClick={() => router.push('/schedine')}
            className="absolute top-4 left-5 text-sm text-white/80 hover:text-white transition-colors bg-black/40 backdrop-blur border border-white/15 px-3 py-1.5 rounded-full">
            ← Tutte le schedine
          </button>

          <div className="absolute bottom-0 inset-x-0 p-5">
            <h1 className="font-display font-bold text-3xl sm:text-4xl drop-shadow-lg">{schedina.nome.replace(' — Mondiali FIFA 2026', '')}</h1>
            <p className="text-sm mt-1 text-white/70">
              Scadenza <span className="text-[var(--gold)] font-medium">{new Date(schedina.deadline).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', timeZone: 'Europe/Rome' })} · {new Date(schedina.deadline).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Le 10 partite */}
      <div className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-widest mb-3">Le 10 partite in gioco</h2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {schedina.partite.map((p: Partita, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-xs text-[var(--muted)] w-11 shrink-0 tabular-nums">
                {new Date(p.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </span>
              <Flag team={p.home} w={40} className="w-5 h-3.5 shrink-0" />
              <span className="text-white/85">{p.home}</span>
              <span className="text-white/25 text-xs">vs</span>
              <Flag team={p.away} w={40} className="w-5 h-3.5 shrink-0" />
              <span className="text-white/85">{p.away}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* STEP 1 — Minuti */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <span className="text-base">🕐</span> Scegli 13 minuti
            </h2>
            <span className={`font-display font-bold text-sm tabular-nums ${completo ? 'text-[var(--accent-soft)]' : 'text-[var(--muted)]'}`}>
              {minuti.length}/{MAX_MINUTI}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mb-4">I minuti (1–90) in cui prevedi un gol in una qualsiasi partita.</p>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent-cyan)] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* Griglia 1–90: tocca per selezionare */}
          <div className="grid grid-cols-9 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 90 }, (_, i) => i + 1).map(m => {
              const selected = minuti.includes(m)
              const disabled = !selected && completo
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMinuto(m)}
                  disabled={disabled}
                  className={`min-cell ${selected ? 'is-selected' : ''}`}
                  title={selected ? 'Tocca per rimuovere' : 'Tocca per selezionare'}
                >
                  {m}
                </button>
              )
            })}
          </div>

          <p className={`text-xs mt-4 ${completo ? 'text-[var(--accent-soft)]' : 'text-[var(--muted)]'}`}>
            {completo
              ? '✓ Tutti i 13 minuti selezionati. Tocca un minuto verde per rimuoverlo.'
              : 'Tocca i numeri per scegliere i minuti in cui prevedi un gol.'}
          </p>
        </div>

        {/* STEP 2 — Recupero */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-1"><span className="text-base">➕</span> Recupero <span className="text-xs font-normal text-[var(--gold)]">+1 punto · facoltativo</span></h2>
          <p className="text-xs text-[var(--muted)] mb-4">Prevedi un gol nei minuti di recupero. Tocca un pulsante (puoi anche saltarlo).</p>
          <div className="grid grid-cols-2 gap-3">
            {(['primo', 'secondo'] as const).map(t => (
              <button key={t} type="button" onClick={() => setRecupero(recupero === t ? null : t)}
                className={`seg-btn px-5 py-3 text-sm ${recupero === t ? 'is-active' : ''}`}>
                {t === 'primo' ? 'Recupero 1° tempo' : 'Recupero 2° tempo'}
              </button>
            ))}
          </div>
        </div>

        {/* STEP 3 — Primo/Ultimo gol */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-1"><span className="text-base">🏆</span> Prima e ultima rete <span className="text-xs font-normal text-[var(--gold)]">+3 / +10 · facoltativo</span></h2>
          <p className="text-xs text-[var(--muted)] mb-5">Quale squadra segnerà il primo e l&apos;ultimo gol tra tutte le partite? Tocca una squadra (puoi anche saltarlo).</p>
          <div className="space-y-6">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-2 font-medium">🥇 Prima squadra a segnare</label>
              <TeamPicker partite={schedina.partite} value={firstGoal} onChange={setFirstGoal} />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-2 font-medium">🏁 Ultima squadra a segnare</label>
              <TeamPicker partite={schedina.partite} value={lastGoal} onChange={setLastGoal} />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Submit */}
        <div>
          <button type="submit" disabled={saving || !completo} className="btn-primary w-full py-4 text-base shadow-2xl">
            {saving ? 'Invio…' : '🔒 Invia pronostico (definitivo)'}
          </button>
          <p className="text-center text-[var(--muted)] text-xs mt-2">
            {!completo
              ? `Aggiungi ancora ${MAX_MINUTI - minuti.length} ${MAX_MINUTI - minuti.length === 1 ? 'minuto' : 'minuti'} per inviare.`
              : 'Attenzione: dopo l’invio il pronostico non sarà più modificabile.'}
          </p>
        </div>
      </form>
    </div>
  )
}
