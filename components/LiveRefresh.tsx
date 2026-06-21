'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Aggiorna i dati della pagina ogni N secondi mentre la scheda è visibile
// (per far "illuminare" in tempo reale i minuti azzeccati durante le partite).
export default function LiveRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    return () => clearInterval(t)
  }, [router, seconds])
  return null
}
