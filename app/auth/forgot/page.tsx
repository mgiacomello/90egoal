'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    if (error) {
      setError('Qualcosa non ha funzionato. Riprova tra poco.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-12 sm:mt-20 animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-2xl shadow-[0_12px_30px_-8px_rgba(0,230,118,0.6)] mb-4">🔑</div>
        <h1 className="font-display font-bold text-2xl">Password dimenticata</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Ti mandiamo un link per reimpostarla</p>
      </div>

      {sent ? (
        <div className="glass rounded-2xl p-6 text-center space-y-3">
          <div className="text-3xl">📩</div>
          <p className="text-sm text-white/85">
            Se esiste un account con <strong className="text-[var(--accent-soft)]">{email.trim()}</strong>,
            ti è arrivata una mail con il link per reimpostare la password.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Controlla anche lo spam. Il link scade dopo un&apos;ora.
          </p>
          <Link href="/auth/login" className="inline-block text-[var(--accent-soft)] hover:underline text-sm font-medium pt-1">
            Torna all&apos;accesso
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
            <label className="block text-sm text-[var(--muted)] mb-1.5">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="tua@email.com" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? 'Invio…' : 'Invia il link'}
          </button>
        </form>
      )}

      <p className="text-center text-[var(--muted)] text-sm mt-5">
        Te la ricordi?{' '}
        <Link href="/auth/login" className="text-[var(--accent-soft)] hover:underline font-medium">Accedi</Link>
      </p>
    </div>
  )
}
