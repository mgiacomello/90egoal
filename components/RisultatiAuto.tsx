'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Tiene vivi i risultati automatici: finché l'app è aperta e in primo piano chiede al
// server un giro di aggiornamento, una volta al minuto se si sta giocando, ogni dieci
// minuti altrimenti. Se è arrivato qualcosa di nuovo ricarica i dati della pagina.
// Non mostra niente.
export default function RisultatiAuto() {
  const router = useRouter()

  useEffect(() => {
    let fermo = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let visto: number | null = null

    async function giro() {
      if (fermo) return
      let attesa = 600
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/risultati/sync', { cache: 'no-store' })
          if (res.ok) {
            const j = await res.json() as { schedine?: unknown[]; ultimoCambio?: number; cambiate?: number }
            if ((j.schedine?.length ?? 0) > 0) attesa = 60
            const cambio = j.ultimoCambio ?? 0
            if ((j.cambiate ?? 0) > 0 || (visto !== null && cambio > visto)) router.refresh()
            visto = cambio
          }
        } catch { /* senza rete si riprova al prossimo giro */ }
      } else {
        attesa = 60
      }
      if (!fermo) timer = setTimeout(giro, attesa * 1000)
    }

    const alRitorno = () => {
      if (document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      giro()
    }
    giro()
    document.addEventListener('visibilitychange', alRitorno)
    return () => {
      fermo = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', alRitorno)
    }
  }, [router])

  return null
}
