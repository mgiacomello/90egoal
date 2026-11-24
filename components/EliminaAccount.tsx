'use client'

import { useState } from 'react'
import { useTx } from '@/components/Lingua'

// In fondo al Profilo: prima un link discreto, poi la conferma scrivendo il proprio nickname.
export default function EliminaAccount({ username }: { username: string }) {
  const tx = useTx()
  const [aperto, setAperto] = useState(false)
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const combacia = conferma.trim().toLowerCase() === username.toLowerCase()

  async function elimina(e: React.FormEvent) {
    e.preventDefault()
    if (!combacia || invio) return
    setErrore('')
    setInvio(true)
    try {
      const res = await fetch('/api/account/elimina', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conferma }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) { setErrore(dati.errore ?? tx('Qualcosa non ha funzionato. Riprova tra poco.', 'Something went wrong. Try again shortly.')); setInvio(false); return }
      // Ricarica completa: la sessione non esiste più.
      window.location.href = '/'
    } catch {
      setErrore(tx('Qualcosa non ha funzionato. Riprova tra poco.', 'Something went wrong. Try again shortly.'))
      setInvio(false)
    }
  }

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className="text-xs text-[var(--muted)] hover:text-[var(--danger)] underline underline-offset-2">
        {tx('Elimina il mio account', 'Delete my account')}
      </button>
    )
  }

  return (
    <form onSubmit={elimina} className="rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] p-4 space-y-3 text-left">
      <p className="font-semibold text-sm text-[var(--danger)]">{tx('Eliminare l\'account?', 'Delete your account?')}</p>
      <p className="text-sm text-[var(--ink)]/85">
        {tx('Vengono cancellati per sempre il profilo, le schedine giocate, i punti, le leghe che hai creato e le tue iscrizioni alle altre. Non si può annullare.',
            'Your profile, the tickets you played, your points, the leagues you created and your memberships in the others are deleted for good. This cannot be undone.')}
      </p>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{tx('Per confermare scrivi il tuo nickname:', 'To confirm, type your nickname:')} <strong className="text-[var(--ink)]">{username}</strong></span>
        <input type="text" value={conferma} onChange={e => setConferma(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off"
          className="input-field w-full px-4 py-2.5 mt-1.5" />
      </label>
      {errore && <p className="text-sm font-semibold text-[var(--danger)]">{errore}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setAperto(false); setConferma(''); setErrore('') }} className="btn-ghost flex-1 py-2.5 text-sm">{tx('Annulla', 'Cancel')}</button>
        <button type="submit" disabled={!combacia || invio}
          className="flex-1 py-2.5 text-sm font-semibold rounded-full bg-[var(--danger)] text-white disabled:opacity-40">
          {invio ? tx('Eliminazione…', 'Deleting…') : tx('Elimina per sempre', 'Delete for good')}
        </button>
      </div>
    </form>
  )
}
