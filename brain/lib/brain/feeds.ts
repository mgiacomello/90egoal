/**
 * I feed RSS e Atom. Funzione pura: niente rete, niente DOM, nessun
 * import di valori, nessun parser XML — un feed è abbastanza regolare
 * da leggersi con le espressioni, e una dipendenza in meno è una
 * dipendenza in meno.
 */

export type FeedItem = {
  id: string
  title: string
  link: string | null
  /** ISO, o null se il feed non lo dice. */
  published: string | null
  /** Testo pulito, senza HTML. */
  summary: string
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—',
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/**
 * Via l'HTML. Due passate di decodifica, perché un feed RSS porta
 * l'HTML *escapato* dentro all'XML (`&lt;p&gt;`): la prima restituisce
 * i tag, che poi si tolgono; la seconda scioglie le entità del testo.
 */
export function stripHtml(html: string): string {
  const markup = decodeEntities(html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  return decodeEntities(
    markup
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')
  const m = block.match(re)
  if (!m) return null
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1])
  const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0]
  const href = pick?.match(/href=["']([^"']+)["']/i)?.[1]
  return href ? decodeEntities(href) : null
}

function toIso(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** RSS 2.0 o Atom, non importa quale: gli articoli, nell'ordine del feed. */
export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = []
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml)

  const blocks = isAtom
    ? [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0])
    : [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0])

  for (const block of blocks) {
    const title = stripHtml(tag(block, 'title') ?? '')
    if (!title) continue
    const link = isAtom ? atomLink(block) : decodeEntities(tag(block, 'link') ?? '') || null
    const id = (isAtom ? tag(block, 'id') : tag(block, 'guid')) ?? link ?? title
    const published = toIso(
      isAtom ? (tag(block, 'published') ?? tag(block, 'updated')) : (tag(block, 'pubDate') ?? tag(block, 'dc:date'))
    )
    const body = isAtom
      ? (tag(block, 'summary') ?? tag(block, 'content') ?? '')
      : (tag(block, 'content:encoded') ?? tag(block, 'description') ?? '')
    out.push({ id: decodeEntities(id).trim(), title, link, published, summary: stripHtml(body).slice(0, 4000) })
  }
  return out
}
