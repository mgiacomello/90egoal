'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trasferisciProva } from '@/lib/prova'

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o password non corretti.')
    } else {
      if (data.user) await trasferisciProva(supabase, data.user.id)
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-12 sm:mt-20 animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] font-display font-extrabold text-2xl mb-4">90</div>
        <h1 className="font-display font-bold text-2xl">Bentornato</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Accedi per giocare la tua schedina</p>
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
