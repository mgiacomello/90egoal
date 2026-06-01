'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Schedina, Risultato, Partita } from '@/lib/types'

interface Props {
  schedine: Schedina[]
  risultatiMap: Record<number, Risultato>
  pronosticiBySched: Record<number, number>
}

export default function AdminPanel({ schedine, risultatiMap, pronosticiBySched }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const schedina = schedine.find(s => s.id === selected)
  const esistente = selected ? risultatiMap[selected] : null

  const [minutiInput, setMinutiInput] = useState('')
  const [minuti, setMinuti] = useState<number[]>([])
  const [recupero, setRecupero] = useState<string>('')
  const [firstGoal, setFirstGoal] = useState('')
  const [lastGoal, setLastGoal] = useState('')
  const [note, setNote] = useState('')

  function selectSchedina(id: number) {
    const r = risultatiMap[id]
    setSelected(id)
    setMinuti(r?.minuti_gol ?? [])
    setRecupero(r?.recupero ?? '')
    setFirstGoal(r?.first_goal_team ?? '')
    setLastGoal(r?.last_goal_team ?? '')
    setNote(r?.note ?? '')
    setMinutiInput('')
    setSaved(false)
    setError('')
  }

  function addMinuto() {
    const m = parseInt(minutiInput)
    if (isNaN(m) || m < 1 || m > 90) { setError('Minuto non valido (1-90).'); return }
    if (minuti.includes(m)) { setError(`${m}' già presente.`); return }
    setMinuti(prev => [...prev, m].sort((a, b) => a - b))
    setMinutiInput('')
    setError('')
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      schedina_id: selected,
      minuti_gol: minuti,
      recupero: recupero || 'nessuno',
      first_goal_team: firstGoal || null,
      last_goal_team: lastGoal || null,
      note: note || null,
    }
    const { error: dbError } = esistente
      ? await supabase.from('risultati').update(payload).eq('schedina_id', selected)
      : await supabase.from('risultati').insert(payload)

    if (dbError) setError(dbError.message)
    else setSaved(true)
    setSaving(false)
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Area riservata</span>
        <h1 className="font-display font-bold text-3xl mt-2">⚙️ Pannello Admin</h1>
        <p className="text-[var(--muted)] mt-2">Inserisci i risultati reali per calcolare automaticamente le classifiche.</p>
      </div>

      {/* Selezione schedina */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {schedine.map(s => (
          <button key={s.id} onClick={() => selectSchedina(s.id)}
            className={`glass glass-hover text-left p-5 rounded-2xl transition-all ${selected === s.id ? 'glow-accent' : ''}`}>
            <div className="font-display font-bold">{s.nome.replace(' — Mondiali FIFA 2026', '')}</div>
            <div className="text-xs text-[var(--muted)] mt-1.5 flex items-center gap-3">
              <span>{pronosticiBySched[s.id] ?? 0} pronostici</span>
              {risultatiMap[s.id] && <span className="text-[var(--accent-soft)]">✓ Risultati inseriti</span>}
            </div>
          </button>
        ))}
      </div>

      {schedina && (
        <div className="glass rounded-2xl p-6 space-y-6">
          <h2 className="font-display font-bold text-lg">Risultati: {schedina.nome.replace(' — Mondiali FIFA 2026', '')}</h2>

          {/* Minuti gol */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">Minuti dei gol reali</label>
            <div className="flex gap-2 mb-3">
              <input type="number" min={1} max={90} value={minutiInput}
                onChange={e => setMinutiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMinuto() } }}
                placeholder="Min" className="input-field w-24 px-3 py-2 text-center font-mono" />
              <button type="button" onClick={addMinuto} className="btn-primary px-4 py-2 text-sm">+ Aggiungi</button>
              <button type="button" onClick={() => setMinuti([])} className="text-sm text-[var(--muted)] hover:text-red-400 transition-colors ml-1">Svuota</button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
              {minuti.length === 0 && <span className="text-[var(--muted)] text-sm self-center">Nessun gol inserito.</span>}
              {minuti.map(m => (
                <button key={m} type="button" onClick={() => setMinuti(prev => prev.filter(x => x !== m))}
                  className="tag-min tag-cyan px-2.5 py-1 text-sm">
                  {m}&apos;
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)] mt-2">Totale: {minuti.length} gol</p>
          </div>

          {/* Recupero */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">Gol nel recupero</label>
            <div className="flex gap-2 flex-wrap">
              {['primo', 'secondo', 'entrambi', 'nessuno'].map(v => (
                <button key={v} type="button" onClick={() => setRecupero(v)}
                  className={`seg-btn px-4 py-2 text-sm capitalize ${recupero === v ? 'is-active' : ''}`}>
                  {v === 'primo' ? '1° tempo' : v === 'secondo' ? '2° tempo' : v}
                </button>
              ))}
            </div>
          </div>

          {/* Prima/ultima squadra */}
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: '🥇 Prima squadra a segnare', value: firstGoal, set: setFirstGoal },
              { label: '🏁 Ultima squadra a segnare', value: lastGoal, set: setLastGoal },
            ].map((f, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">{f.label}</label>
                <select value={f.value} onChange={e => f.set(e.target.value)} className="input-field w-full px-3 py-2.5 text-sm">
                  <option value="">— Nessuna —</option>
                  {schedina.partite.map((p: Partita, i: number) => (
                    <optgroup key={i} label={`${p.home} vs ${p.away}`}>
                      <option value={p.home}>{p.home}</option>
                      <option value={p.away}>{p.away}</option>
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">Note (opzionale)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="input-field w-full px-3 py-2 text-sm resize-none" placeholder="Eventuali note…" />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>}
          {saved && <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/40 text-[var(--accent-soft)] text-sm rounded-xl px-4 py-3">✓ Risultati salvati! La classifica è aggiornata.</div>}

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3.5">
            {saving ? 'Salvataggio…' : esistente ? 'Aggiorna risultati' : 'Pubblica risultati'}
          </button>
        </div>
      )}
    </div>
  )
}
