'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }
  return (
    <button onClick={logout} className={className || 'text-sm text-[var(--muted)] hover:text-red-400 transition-colors'}>
      Esci
    </button>
  )
}
