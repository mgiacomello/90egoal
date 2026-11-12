import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Lega, testoInvito } from '@/lib/leghe'
import ShareButton from '@/components/ShareButton'
import LegaGestione from '@/components/LegaGestione'

export const metadata: Metadata = { title: 'Lega — 90 & Goal' }

export default async function LegaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuova?: string }> }) {
  const { id } = await params
  const { nuova } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/leghe/${id}`)

  // Le regole del database mostrano la lega solo a chi ne fa parte.
  const { data: lega } = await supabase.from('leghe').select('*').eq('id', id).maybeSingle()
  if (!lega) notFound()
  const l = lega as Lega

  const { data: righe } = await supabase.from('leghe_membri').select('user_id, joined_at').eq('lega_id', id).order('joined_at')
  const ids = ((righe ?? []) as { user_id: string }[]).map(r => r.user_id)
  const { data: profili } = ids.length ? await supabase.from('profiles').select('id, username').in('id', ids) : { data: [] }
  const nomi = new Map(((profili ?? []) as { id: string; username: string }[]).map(p => [p.id, p.username]))
  const membri = ids.map(i => ({ id: i, username: nomi.get(i) ?? 'giocatore' }))

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <Link href="/leghe" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Leghe</Link>
        <h1 className="font-display font-bold text-2xl mt-2 break-words">{l.nome}</h1>
        {nuova && <p className="text-sm text-[var(--accent)] font-semibold mt-1">Lega creata. Ora manda il link al gruppo.</p>}
      </div>

      <section className="glass rounded-2xl p-4 text-center">
        <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-semibold">Codice d&apos;invito</p>
        <p className="font-mono font-bold text-3xl tracking-[0.35em] my-2 select-all">{l.codice}</p>
        <p className="text-xs text-[var(--muted)] mb-4">Chi apre il link entra con un tocco, anche se non ha ancora un account.</p>
        <div className="flex justify-center"><ShareButton text={testoInvito(l)} /></div>
      </section>

      <Link href={`/classifica?lega=${l.id}`} className="btn-primary w-full py-3.5">Vedi la classifica della lega →</Link>

      <LegaGestione legaId={l.id} nome={l.nome} sonoCreatore={l.creata_da === user.id} membri={membri} mioId={user.id} creatoreId={l.creata_da} />
    </div>
  )
}
