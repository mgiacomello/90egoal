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

const cache = new Map<string, Promise<FotoLibera | null>>()

export function fotoGiocatore(nome: string, squadra: string): Promise<FotoLibera | null> {
  const chiave = `${nome}|${squadra}`.toLowerCase()
  if (!cache.has(chiave)) cache.set(chiave, cerca(nome, squadra).catch(() => null))
  return cache.get(chiave)!
}

async function cerca(nome: string, squadra: string): Promise<FotoLibera | null> {
  if (!nome.trim()) return null
  // 1. La voce del calciatore: la ricerca dà i titoli; teniamo quelli col cognome.
  const cognome = nome.trim().split(/\s+/).pop()!.toLowerCase()
  const club = squadra.toLowerCase().replace(/\s+u23$/, '')
  const qs = new URLSearchParams({ action: 'query', format: 'json', origin: '*', list: 'search', srsearch: `${nome} calciatore ${squadra}`, srlimit: '5', srnamespace: '0' })
  const rs = await fetch(`https://it.wikipedia.org/w/api.php?${qs}`)
  if (!rs.ok) return null
  const js = await rs.json() as { query?: { search?: { title: string }[] } }
  const titoli = (js.query?.search ?? []).map(x => x.title).filter(t => t.toLowerCase().includes(cognome)).slice(0, 3)
  if (!titoli.length) return null

  // Poi foto e introduzione di quelle voci, lette direttamente (non dal generatore di ricerca,
  // che a volte non restituisce l'introduzione).
  const q = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', titles: titoli.join('|'),
    prop: 'pageimages|info|extracts', piprop: 'thumbnail|name', pithumbsize: '720', inprop: 'url',
    exintro: '1', explaintext: '1', exchars: '600', exlimit: '3',
  })
  const r = await fetch(`https://it.wikipedia.org/w/api.php?${q}`)
  if (!r.ok) return null
  const j = await r.json() as { query?: { pages?: Record<string, { title: string; fullurl: string; pageimage?: string; thumbnail?: { source: string }; extract?: string }> } }
  const pagine = Object.values(j.query?.pages ?? {}).sort((a, b) => titoli.indexOf(a.title) - titoli.indexOf(b.title))
  // Meglio la statuina che la foto di un altro: l'introduzione della voce deve dire
  // "calciatore" e nominare la squadra in cui gioca oggi.
  const voce = pagine.find(p => {
    const intro = (p.extract ?? '').toLowerCase()
    return p.thumbnail && p.pageimage && intro.includes('calciat') && intro.includes(club)
  })
  if (!voce?.thumbnail || !voce.pageimage) return null

  // 2. Autore e licenza dal file su Commons. Senza licenza libera dichiarata, niente foto.
  const c = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    titles: `File:${voce.pageimage}`, prop: 'imageinfo', iiprop: 'extmetadata|url',
  })
  const rc = await fetch(`https://commons.wikimedia.org/w/api.php?${c}`)
  if (!rc.ok) return null
  const jc = await rc.json() as { query?: { pages?: Record<string, { imageinfo?: { descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } }
  const info = Object.values(jc.query?.pages ?? {})[0]?.imageinfo?.[0]
  const meta = info?.extmetadata ?? {}
  const licenza = testo(meta.LicenseShortName?.value ?? '')
  if (!info || !/^(CC|Public domain|PD)/i.test(licenza)) return null

  return {
    url: voce.thumbnail.source,
    pagina: voce.fullurl,
    autore: testo(meta.Artist?.value ?? '') || 'autore su Wikimedia Commons',
    licenza,
    fonte: info.descriptionurl,
  }
}

function testo(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 80)
}
