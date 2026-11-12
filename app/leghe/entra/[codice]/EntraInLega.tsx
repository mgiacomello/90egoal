'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { erroreLega } from '@/lib/leghe'
import { logEvent } from '@/lib/track'

export default function EntraInLega({ codice }: { codice: string }) {
  const router = useRouter()
  const [errore, setErrore] = useState('')
  const [lavoro, setLavoro] = useState(false)

  async function entra() {
    setErrore(''); setLavoro(true)
    const { data, error } = await createClient().rpc('unisciti_lega', { p_codice: codice })
    setLavoro(false)
    if (error || !data) { setErrore(erroreLega(error?.message)); return }
    logEvent('lega_entrato_link', {})
    router.push(`/classifica?lega=${data.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {errore && <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">{errore}</div>}
      <button type="button" onClick={entra} disabled={lavoro} className="btn-primary w-full py-3.5 text-base">{lavoro ? 'Entro…' : 'Entra nella lega'}</button>
    </div>
  )
}
