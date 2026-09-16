'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * L'ingresso.
 *
 * Volutamente spoglio: non c'è una registrazione, non c'è un "crea
 * account", non c'è niente da esplorare. Questa memoria è di una
 * persona, e chiunque altro arrivi qui è arrivato per sbaglio — non
 * gli si offre una porta, gli si mostra che non ce n'è una.
 *
 * Chi entra deve comunque corrispondere a `BRAIN_OWNER_EMAIL`: la
 * sessione apre il cancello, il controllo sul proprietario è dentro,
 * lato server, e vale anche se qualcuno avesse un account qualsiasi
 * sullo stesso progetto Supabase.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) setError('Email o password non corretti.')
    else {
      router.push('/')
      router.refresh()
    }
    setBusy(false)
  }

  return (
    <div className="brain">
      <div className="brain-shell" style={{ maxWidth: '24rem', paddingTop: '5rem' }}>
        <h1 className="brain-mark" style={{ marginBottom: '0.25rem' }}>
          BRAIN<span>.</span>
        </h1>
        <p className="brain-role" style={{ display: 'block', marginBottom: '2rem' }}>
          memoria di lavoro personale
        </p>

        <form className="brain-ask" onSubmit={submit}>
          {error ? <p className="brain-error">{error}</p> : null}

          <div>
            <label className="brain-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              className="brain-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="brain-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="brain-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="brain-actions">
            <button type="submit" className="brain-btn brain-btn-primary" disabled={busy}>
              {busy ? 'Entro…' : 'Entra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
