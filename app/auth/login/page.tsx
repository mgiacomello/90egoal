'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o password non corretti.')
    } else {
      router.push('/schedine')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-12 sm:mt-20 animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-2xl shadow-[0_12px_30px_-8px_rgba(0,230,118,0.6)] mb-4">⚽</div>
        <h1 className="font-display font-bold text-2xl">Bentornato</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Accedi per giocare la tua schedina</p>
      </div>

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

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder="••••••••" />
          <div className="text-right mt-1.5">
            <Link href="/auth/forgot" className="text-xs text-[var(--muted)] hover:text-[var(--accent-soft)] hover:underline">
              Password dimenticata?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
          {loading ? 'Accesso…' : 'Accedi'}
        </button>
      </form>

      <p className="text-center text-[var(--muted)] text-sm mt-5">
        Non hai un account?{' '}
        <Link href="/auth/register" className="text-[var(--accent-soft)] hover:underline font-medium">Registrati</Link>
      </p>
    </div>
  )
}
