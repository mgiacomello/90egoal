'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trasferisciProva } from '@/lib/prova'
import { useTx } from '@/components/Lingua'
import { percorsoDopoAccesso, nessunaIscrizione, suffissoRitorno } from '@/lib/leghe'

export default function LoginPage() {
  const router = useRouter()
  const tx = useTx()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const suffisso = useSyncExternalStore(nessunaIscrizione, suffissoRitorno, () => '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(tx('Email o password non corretti.', 'Wrong email or password.'))
    } else {
      if (data.user) await trasferisciProva(supabase, data.user.id)
      router.push(percorsoDopoAccesso())
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-12 sm:mt-20 animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] font-display font-extrabold text-2xl mb-4">90</div>
        <h1 className="font-display font-bold text-2xl">{tx('Bentornato', 'Welcome back')}</h1>
        <p className="text-[var(--muted)] text-sm mt-1">{tx('Accedi per giocare la tua schedina', 'Sign in to play your ticket')}</p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
        {error && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder={tx('tua@email.com', 'you@email.com')} />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder="••••••••" />
          <div className="text-right mt-1.5">
            <Link href="/auth/forgot" className="text-xs text-[var(--muted)] hover:text-[var(--accent-soft)] hover:underline">
              {tx('Password dimenticata?', 'Forgot your password?')}
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
          {loading ? tx('Accesso…', 'Signing in…') : tx('Accedi', 'Sign in')}
        </button>
      </form>

      <p className="text-center text-[var(--muted)] text-sm mt-5">
        {tx('Non hai un account?', 'No account yet?')}{' '}
        <Link href={`/auth/register${suffisso}`} className="text-[var(--accent-soft)] hover:underline font-medium">{tx('Registrati', 'Sign up')}</Link>
      </p>
    </div>
  )
}
