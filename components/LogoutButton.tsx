'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTx } from '@/components/Lingua'

export default function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const tx = useTx()
  async function logout() {
    await createClient().auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }
  return (
    <button onClick={logout} className={className || 'text-sm text-[var(--muted)] hover:text-[var(--danger)] transition-colors'}>
      {tx('Esci', 'Sign out')}
    </button>
  )
}
