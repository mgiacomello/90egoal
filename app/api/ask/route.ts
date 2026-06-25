import { createClient } from '@/lib/supabase/server'
import { Schedina, MatchDetail, Risultato, ClassificaRow } from '@/lib/types'

export const runtime = 'nodejs'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

// Rate limit molto semplice, per-istanza (best effort): max richieste / finestra per IP.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  arr.push(now)
  hits.set(ip, arr)
  return arr.length > MAX_PER_WINDOW
}

// Costruisce un riassunto compatto dei dati reali del gioco da passare al modello.
async function buildGameContext(): Promise<string> {
  try {
    const supabase = await createClient()
    const [{ data: schedine }, { data: risultati }, { data: classifica }] = await Promise.all([
      supabase.from('schedine').select('*').order('id'),
      supabase.from('risultati').select('*'),       // visibile solo se loggato (RLS)
      supabase.from('classifica').select('username,totale').order('totale', { ascending: false }).limit(10),
    ])

    const risMap = new Map((risultati as Risultato[] | null)?.map(r => [r.schedina_id, r]) ?? [])
    const parts: string[] = []

    for (const s of (schedine as Schedina[] | null) ?? []) {
      const nome = s.nome.replace(' — Mondiali FIFA 2026', '')
      const ris = risMap.get(s.id)
      const dett = (ris?.dettagli as MatchDetail[] | undefined) ?? []
      const lines = s.partite.map(p => {
        const d = dett.find(x => x.home === p.home && x.away === p.away)
        if (d) return `  - ${d.home} ${d.score} ${d.away} (gol: ${d.minuti.join(', ') || '—'})`
        return `  - ${p.home} vs ${p.away} (${p.date}) — non ancora giocata`
      })
      parts.push(`${nome}:\n${lines.join('\n')}`)
    }

    const cls = (classifica as Pick<ClassificaRow, 'username' | 'totale'>[] | null) ?? []
    if (cls.length) {
      parts.push('Classifica generale (top):\n' + cls.map((r, i) => `  ${i + 1}. ${r.username} — ${r.totale} punti`).join('\n'))
    }

    if (!parts.length) return 'Nessun dato di gioco disponibile.'
    return parts.join('\n\n')
  } catch {
    return 'Dati di gioco momentaneamente non disponibili.'
  }
}

const SYSTEM = (gameData: string, today: string) => `Sei l'assistente di "90 & Goal", un gioco di pronostici sul minuto dei gol dei Mondiali FIFA 2026. Oggi è ${today}.

Rispondi in italiano, in modo amichevole e conciso (massimo ~4 frasi), come in un riquadro su una home page. Niente preamboli tipo "Certo!" o "Ecco".

REGOLE IMPORTANTI:
- Per domande sulle schedine, sui risultati o sulla classifica usa SOLO i DATI DEL GIOCO qui sotto. Non inventare minuti, punteggi o posizioni.
- Per curiosità generali sul Mondiale 2026 (formato a 48 squadre, storia, squadre, regole) puoi usare le tue conoscenze. Se non sei sicuro di un dato molto recente o non presente nei DATI DEL GIOCO, dillo con onestà invece di inventare.
- NON dare consigli su quali minuti giocare o pronostici da fare: rispondi in modo neutro (es. "scegli tu, fa parte del bello del gioco!").
- Resta sul tema Mondiali / 90 & Goal. Se la domanda è fuori tema, riportala gentilmente al calcio.

FATTI VERIFICATI sul Mondiale FIFA 2026 (usali, sono corretti):
- Si gioca negli USA, in Canada e in Messico, da giugno a luglio 2026.
- Per la prima volta partecipano 48 squadre (prima erano 32).
- Formato: 12 gironi da 4 squadre. Passano agli ottavi (fase a eliminazione diretta a 32 squadre) le prime due di ogni girone più le 8 migliori terze.
- In totale si giocano 104 partite. La finale è il 19 luglio 2026 al MetLife Stadium di New York/New Jersey.

DATI DEL GIOCO (reali):
${gameData}`

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: 'AI non configurata.' }, { status: 503 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return Response.json({ error: 'Troppe domande, riprova tra poco.' }, { status: 429 })
  }

  let question = ''
  try {
    const body = await request.json()
    question = String(body?.question ?? '').trim()
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }
  if (!question) return Response.json({ error: 'Scrivi una domanda.' }, { status: 400 })
  if (question.length > 300) question = question.slice(0, 300)

  const gameData = await buildGameContext()
  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 600,
        temperature: 0.5,
        messages: [
          { role: 'system', content: SYSTEM(gameData, today) },
          { role: 'user', content: question },
        ],
      }),
    })

    if (res.status === 429) {
      return Response.json({ error: 'Assistente sovraccarico, riprova tra poco.' }, { status: 429 })
    }
    if (!res.ok) {
      console.error('groq error', res.status, await res.text().catch(() => ''))
      return Response.json({ error: 'Errore nel generare la risposta.' }, { status: 500 })
    }

    const data = await res.json()
    const answer = String(data?.choices?.[0]?.message?.content ?? '').trim()
    return Response.json({ answer: answer || 'Non sono riuscito a trovare una risposta, riprova!' })
  } catch (err) {
    console.error('ask route error', err)
    return Response.json({ error: 'Errore nel generare la risposta.' }, { status: 500 })
  }
}
