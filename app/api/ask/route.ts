import { createClient } from '@/lib/supabase/server'
import { Schedina, MatchDetail, Risultato, ClassificaRow } from '@/lib/types'
import { nomeBreve } from '@/lib/teams'

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
      const nome = nomeBreve(s.nome)
      const ris = risMap.get(s.id)
      const dett = (ris?.dettagli as MatchDetail[] | undefined) ?? []
      const lines = s.partite.map(p => {
        const d = dett.find(x => x.home === p.home && x.away === p.away)
        const serie = p.competizione ? `[${p.competizione}] ` : ''
        if (d) {
          const stato = d.stato === 'in_corso' ? ' — IN CORSO' : ''
          return `  - ${serie}${d.home} ${d.score} ${d.away} (gol: ${d.minuti.join(', ') || '—'})${stato}`
        }
        return `  - ${serie}${p.home} vs ${p.away} (${p.date}${p.ora ? ` ore ${p.ora}` : ''}) — non ancora giocata`
      })
      const stato = s.attiva === false ? 'conclusa' : 'in corso / in arrivo'
      parts.push(`${nome}${s.torneo ? ` (${s.torneo}, ${stato})` : ''}:\n${lines.join('\n')}`)
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

const SYSTEM = (gameData: string, today: string) => `Sei l'assistente di "90 & Goal", un gioco di pronostici sui minuti dei gol. Oggi è ${today}.
Ogni schedina ha 10 partite della stessa giornata (in questo periodo: Serie A, Serie B e Serie C). Si scelgono 13 minuti da 1 a 90: +1 punto per ogni minuto in cui c'è almeno un gol in una qualsiasi partita. Bonus: +1 se c'è un gol nel recupero del tempo scelto; +3 per la squadra del primo OPPURE dell'ultimo gol, +10 se entrambe. Nelle schedine a eliminazione diretta c'è anche +5 sui supplementari. I gol nel recupero (45+, 90+) non valgono per i minuti. Scadenza: calcio d'inizio della prima partita. Il pronostico è definitivo.

Rispondi in italiano, in modo amichevole e conciso (massimo ~4 frasi), come in un riquadro su una home page. Niente preamboli tipo "Certo!" o "Ecco".

REGOLE IMPORTANTI:
- Per domande sulle schedine, sui risultati o sulla classifica usa SOLO i DATI DEL GIOCO qui sotto. Non inventare minuti, punteggi, orari o posizioni.
- Per curiosità generali di calcio puoi usare le tue conoscenze, ma su rose, classifiche e risultati recenti di Serie A, B e C non fidarti della memoria: se il dato non è nei DATI DEL GIOCO, dillo con onestà.
- NON dare consigli su quali minuti giocare o pronostici da fare: rispondi in modo neutro (es. "scegli tu, fa parte del bello del gioco!").
- Resta sul tema calcio / 90 & Goal. Se la domanda è fuori tema, riportala gentilmente al calcio.

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
