'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { erroreLega } from '@/lib/leghe'
import { logEvent } from '@/lib/track'

// Due gesti: creare una lega o entrare con il codice ricevuto.
// Sul telefono: un campo e un pulsante per riga, niente altro.
export default function LegheAzioni({ codiceIniziale = '' }: { codiceIniziale?: string }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [codice, setCodice] = useState(codiceIniziale)
  const [errore, setErrore] = useState('')
  const [lavoro, setLavoro] = useState<'' | 'crea' | 'entra'>('')

  async function crea(e: React.FormEvent) {
    e.preventDefault()
    setErrore(''); setLavoro('crea')
    const { data, error } = await createClient().rpc('crea_lega', { p_nome: nome })
    setLavoro('')
    if (error || !data) { setErrore(erroreLega(error?.message)); return }
    logEvent('lega_creata', {})
    router.push(`/leghe/${data.id}?nuova=1`)
    router.refresh()
  }

  async function entra(e: React.FormEvent) {
    e.preventDefault()
    setErrore(''); setLavoro('entra')
    const { data, error } = await createClient().rpc('unisciti_lega', { p_codice: codice })
    setLavoro('')
    if (error || !data) { setErrore(erroreLega(error?.message)); return }
    logEvent('lega_entrato', {})
    router.push(`/classifica?lega=${data.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {errore && <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">{errore}</div>}
      <form onSubmit={crea} className="glass rounded-2xl p-4">
        <label htmlFor="nome-lega" className="block text-sm font-semibold mb-2">Crea una lega</label>
        <div className="flex gap-2">
          <input id="nome-lega" value={nome} onChange={e => setNome(e.target.value)} maxLength={40} required minLength={2}
            placeholder="Es. Bar Sport" className="input-field flex-1 min-w-0 px-3 py-2.5" />
          <button type="submit" disabled={lavoro !== ''} className="btn-primary px-4 py-2.5 text-sm shrink-0">{lavoro === 'crea' ? '…' : 'Crea'}</button>
        </div>
      </form>
      <form onSubmit={entra} className="glass rounded-2xl p-4">
        <label htmlFor="codice-lega" className="block text-sm font-semibold mb-2">Hai un codice?</label>
        <div className="flex gap-2">
          <input id="codice-lega" value={codice} onChange={e => setCodice(e.target.value.toUpperCase())} maxLength={6} required minLength={6}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABC123"
            className="input-field flex-1 min-w-0 px-3 py-2.5 font-mono tracking-[0.3em] uppercase" />
          <button type="submit" disabled={lavoro !== ''} className="btn-ghost px-4 py-2.5 text-sm shrink-0">{lavoro === 'entra' ? '…' : 'Entra'}</button>
        </div>
      </form>
    </div>
  )
}
