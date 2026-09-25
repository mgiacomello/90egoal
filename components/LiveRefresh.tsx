'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Modalità live senza notifiche push: i dati si aggiornano
// - ogni N secondi mentre la pagina è in primo piano;
// - appena si torna sull'app (riapertura della PWA, cambio scheda, sblocco del telefono);
// - a richiesta, col pulsante: nella PWA installata su iPhone non esiste il "trascina per aggiornare".
export default function LiveRefresh({ seconds = 60, generatedAt }: { seconds?: number; generatedAt?: string }) {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    let last = Date.now()
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      // Evita raffiche quando più eventi arrivano insieme (focus + visibilitychange + pageshow).
      if (Date.now() - last < 5000) return
      last = Date.now()
      router.refresh()
    }
    const t = setInterval(() => { last = 0; refresh() }, seconds * 1000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [router, seconds])

  useEffect(() => {
    if (!spinning) return
    const t = setTimeout(() => setSpinning(false), 900)
    return () => clearTimeout(t)
  }, [spinning, generatedAt])

  if (!generatedAt) return null
  const ora = new Date(generatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-[var(--muted)] mb-3">
      <span>Aggiornato alle {ora}</span>
      <button
        onClick={() => { setSpinning(true); router.refresh() }}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 hover:text-white hover:border-white/20 transition-colors"
        aria-label="Aggiorna"
      >
        <span className={spinning ? 'inline-block animate-spin' : 'inline-block'}>↻</span> Aggiorna
      </button>
    </div>
  )
}
