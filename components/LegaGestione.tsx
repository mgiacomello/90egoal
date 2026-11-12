'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { erroreLega } from '@/lib/leghe'

interface Membro { id: string; username: string }

// Gestione di una lega: chi l'ha creata la rinomina, toglie membri o la elimina;
// gli altri possono solo uscire.
export default function LegaGestione({ legaId, nome, sonoCreatore, membri, mioId, creatoreId }: {
  legaId: string; nome: string; sonoCreatore: boolean; membri: Membro[]; mioId: string; creatoreId: string
}) {
  const router = useRouter()
  const [nuovoNome, setNuovoNome] = useState(nome)
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const db = createClient()

  async function esegui(f: () => PromiseLike<{ error: { message: string } | null }>, dopo?: () => void) {
    setErrore(''); setOccupato(true)
    const { error } = await f()
    setOccupato(false)
    if (error) { setErrore(erroreLega(error.message)); return }
    if (dopo) dopo(); else router.refresh()
  }

  const rinomina = (e: React.FormEvent) => {
    e.preventDefault()
    const n = nuovoNome.trim()
    if (n.length < 2 || n.length > 40) { setErrore(erroreLega('nome non valido')); return }
    esegui(() => db.from('leghe').update({ nome: n }).eq('id', legaId))
  }
  const togli = (m: Membro) => {
    if (!confirm(`Togliere ${m.username} dalla lega?`)) return
    esegui(() => db.from('leghe_membri').delete().eq('lega_id', legaId).eq('user_id', m.id))
  }
  const esci = () => {
    if (!confirm('Uscire dalla lega? Potrai rientrare con il codice.')) return
    esegui(() => db.from('leghe_membri').delete().eq('lega_id', legaId).eq('user_id', mioId), () => { router.push('/leghe'); router.refresh() })
  }
  const elimina = () => {
    if (!confirm(`Eliminare "${nome}" per tutti? I punti dei giocatori restano, sparisce solo la lega.`)) return
    esegui(() => db.from('leghe').delete().eq('id', legaId), () => { router.push('/leghe'); router.refresh() })
  }

  return (
    <div className="space-y-4">
      {errore && <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">{errore}</div>}

      <section className="glass rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Membri · {membri.length}</h2>
        <ul className="divide-y divide-[var(--line)]">
          {membri.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">
                {m.username}
                {m.id === mioId && <span className="text-[var(--accent)] text-[10px] font-bold ml-1.5">TU</span>}
                {m.id === creatoreId && <span className="text-[var(--muted)] text-xs ml-1.5">· ha creato la lega</span>}
              </span>
              {sonoCreatore && m.id !== mioId && (
                <button type="button" disabled={occupato} onClick={() => togli(m)} className="text-xs text-[var(--muted)] hover:text-[var(--danger)] shrink-0">Togli</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {sonoCreatore && (
        <form onSubmit={rinomina} className="glass rounded-2xl p-4">
          <label htmlFor="rinomina" className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Nome della lega</label>
          <div className="flex gap-2">
            <input id="rinomina" value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} maxLength={40} className="input-field flex-1 min-w-0 px-3 py-2.5" />
            <button type="submit" disabled={occupato || nuovoNome.trim() === nome} className="btn-ghost px-4 py-2.5 text-sm shrink-0">Salva</button>
          </div>
        </form>
      )}

      <div className="text-center pt-2">
        {sonoCreatore
          ? <button type="button" disabled={occupato} onClick={elimina} className="text-sm text-[var(--danger)] hover:underline">Elimina la lega</button>
          : <button type="button" disabled={occupato} onClick={esci} className="text-sm text-[var(--muted)] hover:text-[var(--danger)]">Esci dalla lega</button>}
      </div>
    </div>
  )
}
