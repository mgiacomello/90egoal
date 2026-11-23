'use client'

import { createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { COOKIE_LINGUA, txDi, type Lingua, type Tx } from '@/lib/lingua'

// La lingua arriva dal server (cookie) e scende a tutti i componenti del browser.
const Contesto = createContext<Lingua>('it')

export function LinguaProvider({ lingua, children }: { lingua: Lingua; children: React.ReactNode }) {
  return <Contesto.Provider value={lingua}>{children}</Contesto.Provider>
}

export function useLingua(): Lingua {
  return useContext(Contesto)
}

// const tx = useTx() → tx('Classifica', 'Standings')
export function useTx(): Tx {
  return txDi(useContext(Contesto))
}

function salvaLingua(l: Lingua) {
  document.cookie = `${COOKIE_LINGUA}=${l}; path=/; max-age=31536000; samesite=lax`
}

// IT · EN: salva la scelta per un anno e ricarica i testi senza cambiare pagina.
export function CambiaLingua({ className = '' }: { className?: string }) {
  const lingua = useLingua()
  const router = useRouter()
  function scegli(l: Lingua) {
    if (l === lingua) return
    salvaLingua(l)
    router.refresh()
  }
  const voce = (l: Lingua, etichetta: string, nome: string) => (
    <button type="button" onClick={() => scegli(l)} aria-pressed={lingua === l} aria-label={nome} lang={l}
      className={`px-1.5 py-1 font-semibold transition-colors ${lingua === l ? 'text-[var(--ink)] underline underline-offset-4' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
      {etichetta}
    </button>
  )
  return (
    <span className={`inline-flex items-center text-xs ${className}`} role="group" aria-label="Lingua · Language">
      {voce('it', 'IT', 'Italiano')}
      <span aria-hidden className="text-[var(--line)]">·</span>
      {voce('en', 'EN', 'English')}
    </span>
  )
}
