// La foto vera del marcatore, solo se è a licenza libera: Wikipedia in italiano non
// usa foto non libere di persone viventi, quindi l'immagine principale della voce
// viene da Wikimedia Commons. Si mostra con autore e licenza, come la licenza chiede.
// Nessuna foto (succede spesso in Serie C) → null, e il popup mostra la statuina.

export interface FotoLibera {
  url: string
  pagina: string      // voce di Wikipedia, per chi vuole sapere chi è
  autore: string      // testo semplice, senza HTML
  licenza: string     // "CC BY-SA 4.0"
  fonte: string       // pagina del file su Commons
}

const cache = new Map<string, Promise<FotoLibera[]>>()

// Le foto candidate, dalla migliore: prima quelle in azione con la maglia del club,
// poi il ritratto della voce. Chi le usa prova la prima che si ritaglia bene.
export function fotoGiocatore(nome: string, squadra: string): Promise<FotoLibera[]> {
  const chiave = `${nome}|${squadra}`.toLowerCase()
  if (!cache.has(chiave)) cache.set(chiave, cerca(nome, squadra).catch(() => []))
  return cache.get(chiave)!
}

async function cerca(nome: string, squadra: string): Promise<FotoLibera[]> {
  if (!nome.trim()) return []
  // 1. La voce del calciatore: la ricerca dà i titoli; teniamo quelli col cognome.
  const cognome = nome.trim().split(/\s+/).pop()!.toLowerCase()
  const club = squadra.toLowerCase().replace(/\s+u23$/, '')
  const qs = new URLSearchParams({ action: 'query', format: 'json', origin: '*', list: 'search', srsearch: `${nome} calciatore ${squadra}`, srlimit: '5', srnamespace: '0' })
  const rs = await fetch(`https://it.wikipedia.org/w/api.php?${qs}`)
  if (!rs.ok) return []
  const js = await rs.json() as { query?: { search?: { title: string }[] } }
  const titoli = (js.query?.search ?? []).map(x => x.title).filter(t => t.toLowerCase().includes(cognome)).slice(0, 3)
  if (!titoli.length) return []

  // Poi foto e introduzione di quelle voci, lette direttamente (non dal generatore di ricerca,
  // che a volte non restituisce l'introduzione).
  const q = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', titles: titoli.join('|'),
    prop: 'pageimages|info|extracts', piprop: 'thumbnail|name', pithumbsize: '1400', inprop: 'url',
    exintro: '1', explaintext: '1', exchars: '600', exlimit: '3',
  })
  const r = await fetch(`https://it.wikipedia.org/w/api.php?${q}`)
  if (!r.ok) return []
  const j = await r.json() as { query?: { pages?: Record<string, { title: string; fullurl: string; pageimage?: string; thumbnail?: { source: string }; extract?: string }> } }
  const pagine = Object.values(j.query?.pages ?? {}).sort((a, b) => titoli.indexOf(a.title) - titoli.indexOf(b.title))
  // Meglio la statuina che la foto di un altro: l'introduzione della voce deve dire
  // "calciatore" e nominare la squadra in cui gioca oggi.
  const voce = pagine.find(p => {
    const intro = (p.extract ?? '').toLowerCase()
    return p.thumbnail && p.pageimage && intro.includes('calciat') && intro.includes(club)
  })
  if (!voce?.thumbnail || !voce.pageimage) return []

  // 2. Autore e licenza dal file su Commons. Senza licenza libera dichiarata, niente foto.
  const c = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    titles: `File:${voce.pageimage}`, prop: 'imageinfo', iiprop: 'extmetadata|url',
  })
  const rc = await fetch(`https://commons.wikimedia.org/w/api.php?${c}`)
  if (!rc.ok) return []
  const jc = await rc.json() as { query?: { pages?: Record<string, { imageinfo?: { descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } }
  const info = Object.values(jc.query?.pages ?? {})[0]?.imageinfo?.[0]
  const meta = info?.extmetadata ?? {}
  const licenza = testo(meta.LicenseShortName?.value ?? '')
  // Anche il ritratto deve essere con la maglia del club: molte voci hanno la foto in
  // Nazionale o in una squadra di prima, e la maglia sbagliata si nota più della foto giusta.
  const ritrattoColClub = `${voce.pageimage} ${testo(meta.ImageDescription?.value ?? '')}`.toLowerCase().includes(club)
  const ritratto: FotoLibera[] = info && ritrattoColClub && /^(CC|Public domain|PD)/i.test(licenza) ? [{
    url: voce.thumbnail.source,
    pagina: voce.fullurl,
    autore: testo(meta.Artist?.value ?? '') || 'autore su Wikimedia Commons',
    licenza,
    fonte: info.descriptionurl,
  }] : []

  // Le foto in campo (partita, gol, esultanza) vengono prima del ritratto.
  const azione = await fotoAzione(voce.title, cognome, club).catch(() => [] as Omit<FotoLibera, 'pagina'>[])
  return [...azione.map(a => ({ ...a, pagina: voce.fullurl })), ...ritratto]
}

interface FileCommons {
  title: string
  imageinfo?: { url: string; thumburl?: string; descriptionurl: string; width: number; height: number; extmetadata?: Record<string, { value: string }> }[]
}

// Cerca su Commons una foto del giocatore in azione, con la maglia del club di oggi.
// Punteggio: nome nel titolo del file (una persona sola), il club nel titolo o nella
// descrizione, parole da partita o esultanza, formato verticale, risoluzione.
// Scarta le foto di coppia ("X and Y", "with") e quelle piccole. Se c'è almeno una foto
// col club, le altre (Nazionale, squadre di prima) non si considerano: la maglia conta.
async function fotoAzione(nomeCompleto: string, cognome: string, club: string): Promise<Omit<FotoLibera, 'pagina'>[]> {
  const q = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrsearch: `"${nomeCompleto}" filetype:bitmap`, gsrnamespace: '6', gsrlimit: '40',
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1400',
  })
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`)
  if (!r.ok) return []
  const j = await r.json() as { query?: { pages?: Record<string, FileCommons> } }
  const file = Object.values(j.query?.pages ?? {})
  const colClub = (f: FileCommons) => {
    const i = f.imageinfo?.[0]
    const t = `${f.title} ${testo(i?.extmetadata?.ImageDescription?.value ?? '')}`.toLowerCase()
    return t.includes(club)
  }
  // Senza una foto col club di oggi, meglio il ritratto che una maglia sbagliata.
  const candidati = file.filter(colClub)
  if (!candidati.length) return []
  const valutate: { punti: number; f: FileCommons }[] = []
  for (const f of candidati) {
    const i = f.imageinfo?.[0]
    if (!i || !/\.(jpe?g|png)$/i.test(f.title)) continue
    const lic = testo(i.extmetadata?.LicenseShortName?.value ?? '')
    if (!/^(CC|Public domain|PD)/i.test(lic)) continue
    const titolo = f.title.replace(/^File:/, '').toLowerCase()
    const descr = testo(i.extmetadata?.ImageDescription?.value ?? '').toLowerCase()
    const tutto = `${titolo} ${descr}`
    if (/\b(and|with|und|et|e)\b/.test(titolo) && !titolo.startsWith(cognome)) continue   // foto di coppia
    if (Math.min(i.width, i.height) < 900) continue
    let punti = 0
    if (titolo.includes(cognome)) punti += 4
    if (tutto.includes(club)) punti += 4
    if (/\b(goal|gol|celebrat|festegg|scor)/.test(tutto)) punti += 3
    if (/\b(vs?|v\.|match|partita|league|cup|coppa|stadium|stadio|final)/.test(tutto)) punti += 2
    const rapporto = i.height / i.width
    if (rapporto >= 1.05) punti += 2
    else if (rapporto < 0.8) punti -= 2
    if (Math.min(i.width, i.height) >= 1600) punti += 1
    if (punti >= 4) valutate.push({ punti, f })
  }
  return valutate.sort((a, b) => b.punti - a.punti).slice(0, 4).map(({ f }) => {
    const i = f.imageinfo![0]
    return {
      url: i.thumburl ?? i.url,
      autore: testo(i.extmetadata?.Artist?.value ?? '') || 'autore su Wikimedia Commons',
      licenza: testo(i.extmetadata?.LicenseShortName?.value ?? ''),
      fonte: i.descriptionurl,
    }
  })
}

function testo(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 80)
}
