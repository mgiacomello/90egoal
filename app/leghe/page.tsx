import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mieLeghe } from '@/lib/leghe'
import LegheAzioni from '@/components/LegheAzioni'
import { IconTrophy } from '@/components/Icons'
import { txServer } from '@/lib/lingua.server'

export async function generateMetadata(): Promise<Metadata> {
  const { tx } = await txServer()
  return { title: tx('Leghe — 90 & Goal', 'Leagues — 90 & Goal') }
}

export default async function LeghePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/leghe')

  const leghe = await mieLeghe(supabase, user.id)
  const { tx } = await txServer()

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">{tx('Leghe tra amici', 'Leagues with friends')}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{tx('Stesse schedine di tutti, una classifica solo vostra. Crea una lega e manda il link al gruppo.', 'Same tickets as everyone, standings of your own. Create a league and send the link to your group.')}</p>
      </div>

      {leghe.length > 0 && (
        <div className="space-y-2">
          {leghe.map(l => (
            <div key={l.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <IconTrophy size={20} className="text-[var(--gold)] shrink-0" />
              <Link href={`/classifica?lega=${l.id}`} className="flex-1 min-w-0">
                <div className="font-semibold truncate">{l.nome}</div>
                <div className="text-xs text-[var(--muted)]">{l.membri.length} {l.membri.length === 1 ? tx('giocatore', 'player') : tx('giocatori', 'players')}</div>
              </Link>
              <Link href={`/leghe/${l.id}`} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] px-2 py-1 shrink-0">{tx('Invita', 'Invite')}</Link>
              <Link href={`/classifica?lega=${l.id}`} className="btn-ghost px-3 py-1.5 text-xs shrink-0">{tx('Classifica', 'Standings')}</Link>
            </div>
          ))}
        </div>
      )}

      <LegheAzioni />
    </div>
  )
}
