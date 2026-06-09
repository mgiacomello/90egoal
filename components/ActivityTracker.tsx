'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Registra un "battito" ogni 60s mentre l'utente è loggato e la scheda è visibile.
// Serve a stimare il tempo di permanenza in piattaforma (1 battito ≈ 1 minuto).
const INTERVAL_MS = 60_000

export default function ActivityTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setInterval> | null = null
    let lastBeat = 0

    async function beat() {
      if (document.visibilityState !== 'visible') return
      // throttle: evita doppi battiti ravvicinati (cambi pagina rapidi)
      if (Date.now() - lastBeat < INTERVAL_MS - 5000) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      lastBeat = Date.now()
      await supabase.from('activity').insert({ user_id: user.id, path: window.location.pathname })
    }

    // battito iniziale + a intervalli
    beat()
    timer = setInterval(beat, INTERVAL_MS)

    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname])

  return null
}
