'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Il link della mail apre questa pagina con una sessione di recovery.
  useEffect(() => {
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      setChecking(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return }
    if (password !== confirm) { setError('Le due password non coincidono.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Non è stato possibile aggiornare la password. Richiedi un nuovo link.')
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => { router.push('/schedine'); router.refresh() }, 1500)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12 sm:mt-20 animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-2xl shadow-[0_12px_30px_-8px_rgba(0,230,118,0.6)] mb-4">🔒</div>
        <h1 className="font-display font-bold text-2xl">Nuova password</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Scegli una password per il tuo account</p>
      </div>

      {done ? (
        <div className="glass rounded-2xl p-6 text-center space-y-2">
          <div className="text-3xl">✅</div>
          <p className="text-sm text-white/85">Password aggiornata! Ti sto portando alle schedine…</p>
        </div>
      ) : checking ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-[var(--muted)]">Verifica del link…</div>
      ) : !ready ? (
        <div className="glass rounded-2xl p-6 text-center space-y-3">
          <div className="text-3xl">⏳</div>
          <p className="text-sm text-white/85">
            Questo link non è più valido o è scaduto.
          </p>
          <Link href="/auth/forgot" className="inline-block text-[var(--accent-soft)] hover:underline text-sm font-medium">
            Richiedi un nuovo link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">Nuova password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="••••••••" />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">Conferma password</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? 'Salvataggio…' : 'Salva password'}
          </button>
        </form>
      )}
    </div>
  )
}
