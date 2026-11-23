'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PRIVACY_VERSIONE, TITOLARE, privacyDaAccettare } from '@/lib/privacy'
import { useTx } from '@/components/Lingua'

// La finestra in sé, senza dati: così si può provare e riusare.
export function PrivacyFinestra({ onAccetta, onEsci, lavoro, errore }: { onAccetta: () => void; onEsci: () => void; lavoro: boolean; errore: string }) {
  const tx = useTx()
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[rgba(20,48,31,0.55)] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="privacy-titolo">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-t-[28px] sm:rounded-[28px] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] space-y-4 shadow-2xl">
        <h2 id="privacy-titolo" className="font-display font-bold text-xl leading-tight">{tx('Informativa privacy', 'Privacy notice')}</h2>
        <p className="text-sm text-[var(--ink)]/85 leading-relaxed">
          {tx(`Abbiamo pubblicato l'informativa su come ${TITOLARE.nome} tratta i tuoi dati: cosa raccogliamo, perché, e quali sono i tuoi diritti. Per continuare a giocare ti chiediamo di leggerla.`, `We have published the notice on how ${TITOLARE.nome} handles your data: what we collect, why, and what your rights are. To keep playing, please read it.`)}
        </p>
        <a href="/privacy" target="_blank" rel="noopener" className="btn-ghost w-full py-3 text-sm">{tx('Leggi l\'informativa', 'Read the notice')}</a>
        {errore && <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">{errore}</div>}
        <button type="button" onClick={onAccetta} disabled={lavoro} className="btn-primary w-full py-3.5 text-base">
          {lavoro ? tx('Un attimo…', 'One moment…') : tx('Ho letto, continua', 'I have read it, continue')}
        </button>
        <p className="text-xs text-[var(--muted)] text-center">
          {tx('Confermando dichiari di aver letto l\'informativa e di avere almeno 14 anni.', 'By confirming you declare that you have read the notice and are at least 14 years old.')}{' '}
          <button type="button" onClick={onEsci} className="underline">{tx('Esci dall\'account', 'Sign out')}</button>
        </p>
      </div>
    </div>
  )
}

// Compare a chi ha fatto l'accesso ma non ha ancora accettato l'informativa in vigore.
// Chi non ha fatto l'accesso non vede niente: per i nuovi c'è la casella alla registrazione.
export default function PrivacyAvviso() {
  const router = useRouter()
  const tx = useTx()
  const [serve, setServe] = useState(false)
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    const supabase = createClient()
    let vivo = true
    const controlla = (metadata: Record<string, unknown> | undefined, loggato: boolean) => { if (vivo) setServe(loggato && privacyDaAccettare(metadata)) }
    supabase.auth.getUser().then(({ data }) => controlla(data.user?.user_metadata, !!data.user))
    // Anche subito dopo il login, senza ricaricare la pagina.
    const { data: ascolto } = supabase.auth.onAuthStateChange((_evento, sessione) => controlla(sessione?.user?.user_metadata, !!sessione?.user))
    return () => { vivo = false; ascolto.subscription.unsubscribe() }
  }, [])

  async function accetta() {
    setErrore(''); setLavoro(true)
    const { error } = await createClient().auth.updateUser({ data: { privacy_accettata_il: new Date().toISOString(), privacy_versione: PRIVACY_VERSIONE } })
    setLavoro(false)
    if (error) { setErrore(tx('Non siamo riusciti a salvare. Controlla la connessione e riprova.', 'We could not save. Check your connection and try again.')); return }
    setServe(false)
  }

  async function esci() {
    await createClient().auth.signOut()
    setServe(false)
    router.push('/auth/login')
    router.refresh()
  }

  if (!serve) return null
  return <PrivacyFinestra onAccetta={accetta} onEsci={esci} lavoro={lavoro} errore={errore} />
}
