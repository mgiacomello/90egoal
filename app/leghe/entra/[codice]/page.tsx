import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EntraInLega from './EntraInLega'

export const metadata: Metadata = { title: 'Invito a una lega — 90 & Goal' }

// La pagina che si apre dal link mandato su WhatsApp. Funziona anche senza account:
// mostra la lega e porta a registrazione o accesso, poi si torna qui.
export default async function EntraPage({ params }: { params: Promise<{ codice: string }> }) {
  const { codice: grezzo } = await params
  const codice = decodeURIComponent(grezzo).trim().toUpperCase()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase.rpc('anteprima_lega', { p_codice: codice })
  const lega = (data as { nome: string; membri: number; creatore: string | null }[] | null)?.[0]

  if (user && lega) {
    // Già dentro? Dritto alla classifica.
    const { data: gia } = await supabase.from('leghe').select('id').eq('codice', codice).maybeSingle()
    if (gia) redirect(`/classifica?lega=${gia.id}`)
  }

  const ritorno = encodeURIComponent(`/leghe/entra/${codice}`)

  return (
    <div className="max-w-sm mx-auto mt-10 animate-fade-up">
      <div className="text-center mb-6">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] font-display font-extrabold text-2xl mb-4">90</div>
        {lega ? (
          <>
            <p className="text-sm text-[var(--muted)]">{lega.creatore ? <><strong className="text-[var(--ink)]">{lega.creatore}</strong> ti invita nella lega</> : 'Sei invitato nella lega'}</p>
            <h1 className="font-display font-bold text-2xl mt-1 break-words">{lega.nome}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">{lega.membri} {lega.membri === 1 ? 'giocatore' : 'giocatori'} · stesse schedine di tutti, classifica solo vostra</p>
          </>
        ) : (
          <>
            <h1 className="font-display font-bold text-2xl">Codice non valido</h1>
            <p className="text-sm text-[var(--muted)] mt-1">Il link potrebbe essere incompleto. Chiedi di nuovo l&apos;invito o scrivi il codice a mano.</p>
          </>
        )}
      </div>

      {lega && (user
        ? <EntraInLega codice={codice} />
        : (
          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-sm text-center">Per entrare serve un account: ci vogliono trenta secondi.</p>
            <Link href={`/auth/register?next=${ritorno}`} className="btn-primary w-full py-3">Registrati ed entra</Link>
            <Link href={`/auth/login?next=${ritorno}`} className="btn-ghost w-full py-3">Ho già un account</Link>
          </div>
        ))}

      {!lega && <div className="text-center"><Link href={user ? '/leghe' : '/'} className="btn-ghost px-5 py-2.5 text-sm">{user ? 'Inserisci il codice' : 'Vai al gioco'}</Link></div>}

      <p className="text-center text-xs text-[var(--muted)] mt-6">90 &amp; Goal: scegli 13 minuti, ogni gol in uno dei tuoi è un punto. <Link href="/regole" className="underline">Regole</Link></p>
    </div>
  )
}
