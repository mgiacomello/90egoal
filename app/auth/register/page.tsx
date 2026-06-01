'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) { setError('Le password non coincidono.'); return }
    if (form.password.length < 6) { setError('La password deve essere di almeno 6 caratteri.'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) { setError('Il nickname può contenere solo lettere, numeri e _'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { username: form.username.toLowerCase(), full_name: form.fullName } },
    })

    if (error) {
      setError(error.message === 'User already registered' ? 'Email già registrata.' : error.message)
    } else {
      router.push('/schedine')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-8 sm:mt-14 animate-fade-up">
      <div className="text-center mb-7">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-2xl shadow-[0_12px_30px_-8px_rgba(0,230,118,0.6)] mb-4">⚽</div>
        <h1 className="font-display font-bold text-2xl">Crea il tuo account</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Partecipa ai pronostici dei Mondiali FIFA 2026</p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Nome completo</label>
          <input type="text" required value={form.fullName} onChange={e => update('fullName', e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder="Mario Rossi" />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Nickname <span className="text-white/30">(in classifica)</span></label>
          <input type="text" required value={form.username} onChange={e => update('username', e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder="mariorossi" maxLength={20} />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1.5">Email</label>
          <input type="email" required value={form.email} onChange={e => update('email', e.target.value)}
            className="input-field w-full px-4 py-2.5" placeholder="tua@email.com" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">Password</label>
            <input type="password" required value={form.password} onChange={e => update('password', e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="Min 6" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1.5">Conferma</label>
            <input type="password" required value={form.confirm} onChange={e => update('confirm', e.target.value)}
              className="input-field w-full px-4 py-2.5" placeholder="••••••" />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
          {loading ? 'Registrazione…' : 'Crea account'}
        </button>
      </form>

      <p className="text-center text-[var(--muted)] text-sm mt-5">
        Hai già un account?{' '}
        <Link href="/auth/login" className="text-[var(--accent-soft)] hover:underline font-medium">Accedi</Link>
      </p>
    </div>
  )
}
