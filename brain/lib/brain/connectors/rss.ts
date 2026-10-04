import { parseFeed } from '../feeds'
import type { BrainDocument } from '../types'
import { clip, mapLimit, type Connector, type SyncWindow } from './types'

/**
 * Il web, nella forma in cui si lascia leggere senza chiavi: i feed
 * RSS e Atom. Non è "internet" — è una lista di testate scelte, letta
 * ogni notte come il resto della memoria. Il Radar lavora su questo:
 * articoli con una data, un titolo e un link, che si possono citare.
 *
 * `BRAIN_FEEDS` (URL separati da virgola) sostituisce la lista
 * predefinita, che è pensata per chi fa legal tech e governance
 * dell'IA.
 */

export const DEFAULT_FEEDS = [
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://hnrss.org/frontpage',
  'https://www.producthunt.com/feed',
  'https://feeds.arstechnica.com/arstechnica/technology-lab',
  'https://www.technologyreview.com/feed/',
]

function feeds(): string[] {
  const custom = process.env.BRAIN_FEEDS?.split(',').map((s) => s.trim()).filter(Boolean)
  return custom?.length ? custom : DEFAULT_FEEDS
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function readFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BRAIN/1 (+personal reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`${hostOf(url)} ha risposto ${res.status}`)
  return res.text()
}

export const rssConnector: Connector = {
  key: 'web',
  label: 'Web (feed)',
  hint: 'Feed RSS/Atom senza chiavi: BRAIN_FEEDS (URL separati da virgola) o la lista predefinita per legal tech e IA.',
  configured: () => true,
  connected: async () => true,

  async fetch({ since, limit }: SyncWindow): Promise<BrainDocument[]> {
    const urls = feeds()
    const perFeed = Math.max(5, Math.floor(limit / urls.length))

    const batches = await mapLimit(urls, 3, async (url) => {
      let xml: string
      try {
        xml = await readFeed(url)
      } catch {
        // Un feed giù non ferma gli altri.
        return [] as BrainDocument[]
      }
      const host = hostOf(url)
      return parseFeed(xml)
        .filter((item) => !item.published || Date.parse(item.published) >= since.getTime())
        .slice(0, perFeed)
        .map(
          (item): BrainDocument => ({
            source: 'web',
            kind: 'article',
            externalId: item.id.slice(0, 500),
            title: item.title,
            body: clip(`${host}\n\n${item.summary || item.title}`),
            occurredAt: item.published ?? new Date().toISOString(),
            url: item.link,
            participants: [],
            metadata: { feed: url, host },
          })
        )
    })

    return batches.flat()
  },
}
