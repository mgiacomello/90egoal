'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/track'
import { trasferisciProva } from '@/lib/prova'
import { PRIVACY_VERSIONE, TITOLARE } from '@/lib/privacy'
import { useTx, useLingua } from '@/components/Lingua'
import { percorsoDopoAccesso, nessunaIscrizione, suffissoRitorno } from '@/lib/leghe'

export default function RegisterPage() {
  const router = useRouter()
  const tx = useTx()
  const lingua = useLingua()
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirm: '', invito: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const suffisso = useSyncExternalStore(nessunaIscrizione, suffissoRitorno, () => '')
  const [serveInvito, setServeInvito] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const startedAt = useRef<number>(0)

  // Test chiuso: il campo codice compare solo se l'admin l'ha attivato nel database.
  // Se la funzione non esiste ancora (migration non eseguita) la registrazione resta libera.
  useEffect(() => {
    startedAt.current = Date.now()
    createClient().rpc('invito_richiesto').then(({ data }) => setServeInvito(data === true))
  }, [])

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!privacy) { setError(tx('Per registrarti devi aver letto l\'informativa privacy.', 'To sign up you must have read the privacy notice.')); return }
    if (form.password !== form.confirm) { setError(tx('Le password non coincidono.', 'The passwords do not match.')); return }
    if (form.password.length < 6) { setError(tx('La password deve essere di almeno 6 caratteri.', 'The password must be at least 6 characters long.')); return }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) { setError(tx('Il nickname può contenere solo lettere, numeri e _', 'The nickname can only contain letters, numbers and _')); return }

    setLoading(true)
    const supabase = createClient()

    // Controlli preventivi, per dare un errore chiaro: a decidere resta il database.
    const [{ data: libero }, { data: invitoOk }] = await Promise.all([
      supabase.rpc('username_disponibile', { nome: form.username }),
      supabase.rpc('invito_valido', { codice: form.invito }),
    ])
    if (libero === false) { setError(tx('Nickname già in uso: scegline un altro.', 'Nickname already taken: choose another one.')); setLoading(false); return }
    if (invitoOk === false) { setError(tx('Codice invito non valido. Chiedilo a chi ti ha mandato il link.', 'Invalid invite code. Ask whoever sent you the link.')); setLoading(false); return }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: {
        username: form.username.toLowerCase(), full_name: form.fullName, invito: form.invito.trim(),
        // Prova dell'accettazione: quando e quale versione dell'informativa.
        privacy_accettata_il: new Date().toISOString(), privacy_versione: PRIVACY_VERSIONE,
      } },
    })

    if (error) {
      setError(
        error.message === 'User already registered' ? tx('Email già registrata.', 'Email already registered.')
        : /database error/i.test(error.message) ? tx('Registrazione non riuscita: controlla il codice invito o scegli un altro nickname.', 'Sign-up failed: check the invite code or choose another nickname.')
        : error.message
      )
    } else {
      await logEvent('register', { ms: Date.now() - startedAt.current })
      // La schedina di prova, se c'è, diventa quella vera: niente da rifare.
      if (data.user) await trasferisciProva(supabase, data.user.id)
      router.push(percorsoDopoAccesso())
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-8 sm:mt-14 animate-fade-up">
      <div className="text-center mb-7">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] font-display font-extrabold text-2xl mb-4">90</div>
        <h1 className="font-display font-bold text-2xl">{tx('Crea il tuo account', 'Create your account')}</h1>
        <p className="text-[var(--muted)] text-sm mt-1">{tx('Indovina i minuti dei gol, giornata dopo giornata', 'Guess the minutes of the goals, matchday after matchday')}</p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
        {error && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">{tx('Nome completo', 'Full name')}</label>
          <input type="text" required value={form.fullName} onChange={e => update('fullName', e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder={tx('Mario Rossi', 'Alex Smith')} />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Nickname <span className="text-[var(--muted)]">{tx('(in classifica)', '(shown in the standings)')}</span></label>
          <input type="text" required value={form.username} onChange={e => update('username', e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder={tx('mariorossi', 'alexsmith')} maxLength={20} />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Email</label>
          <input type="email" required value={form.email} onChange={e => update('email', e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder={tx('tua@email.com', 'you@email.com')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">Password</label>
            <input type="password" required value={form.password} onChange={e => update('password', e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="Min 6" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">{tx('Conferma', 'Confirm')}</label>
            <input type="password" required value={form.confirm} onChange={e => update('confirm', e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="••••••" />
          </div>
        </div>

        {serveInvito && (
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">{tx('Codice invito', 'Invite code')} <span className="text-[var(--muted)]">{tx('(test chiuso)', '(closed test)')}</span></label>
            <input type="text" required value={form.invito} onChange={e => update('invito', e.target.value)}
              className="input-field w-full px-4 py-2.5 uppercase tracking-wider" placeholder={tx("Te l'ha dato chi ti ha invitato", 'You got it from whoever invited you')} autoCapitalize="characters" />
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-[var(--ink)]/85 cursor-pointer pt-1">
          <input type="checkbox" required checked={privacy} onChange={e => setPrivacy(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--accent)]" />
          <span>
            {lingua === 'en' ? (
              <>I have read the <Link href="/privacy" target="_blank" className="text-[var(--accent-soft)] underline font-medium">privacy notice</Link> of {TITOLARE.nome} and I am at least 14 years old.</>
            ) : (
              <>Ho letto l&apos;<Link href="/privacy" target="_blank" className="text-[var(--accent-soft)] underline font-medium">informativa privacy</Link> di {TITOLARE.nome} e ho almeno 14 anni.</>
            )}
          </span>
        </label>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
          {loading ? tx('Registrazione…', 'Signing up…') : tx('Crea account', 'Create account')}
        </button>
      </form>

      <p className="text-center text-[var(--muted)] text-sm mt-5">
        {tx('Hai già un account?', 'Already have an account?')}{' '}
        <Link href={`/auth/login${suffisso}`} className="text-[var(--accent-soft)] hover:underline font-medium">{tx('Accedi', 'Sign in')}</Link>
      </p>
    </div>
  )
}
