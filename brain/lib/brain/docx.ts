import { inflateRawSync } from 'node:zlib'

/**
 * I .docx, senza dipendenze. Un .docx è uno zip con dentro
 * `word/document.xml`; lo zip si legge dal suo indice in coda, il
 * testo si tira fuori dai `<w:t>` paragrafo per paragrafo. È tutto
 * quello che serve a mettere un contratto in memoria — e per chi fa
 * l'avvocato i contratti arrivano quasi sempre così, non come Google
 * Doc.
 */

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

export type ZipEntry = { name: string; data: Buffer }

/** Le voci di uno zip classico (niente ZIP64: un .docx non ne ha bisogno). */
export function readZip(buffer: Buffer): ZipEntry[] {
  const out: ZipEntry[] = []
  let eocd = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 70_000); i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return out

  const entries = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)

  for (let n = 0; n < entries; n += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL) break
    const method = buffer.readUInt16LE(offset + 10)
    const compressed = buffer.readUInt32LE(offset + 20)
    const nameLen = buffer.readUInt16LE(offset + 28)
    const extraLen = buffer.readUInt16LE(offset + 30)
    const commentLen = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')
    offset += 46 + nameLen + extraLen + commentLen

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL) continue
    const lNameLen = buffer.readUInt16LE(localOffset + 26)
    const lExtraLen = buffer.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + lNameLen + lExtraLen
    const raw = buffer.subarray(start, start + compressed)
    try {
      out.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) })
    } catch {
      // Una voce rotta non deve far perdere le altre.
    }
  }
  return out
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => ENTITIES[n])
}

/** Il testo di `word/document.xml`: un paragrafo per riga, tabulazioni e a capo rispettati. */
export function textFromDocumentXml(xml: string): string {
  const paragraphs = xml.split(/<\/w:p>/)
  const lines: string[] = []
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g
  for (const p of paragraphs) {
    let line = ''
    for (const m of p.matchAll(re)) {
      if (m[1] !== undefined) line += decode(m[1])
      else if (m[0].startsWith('<w:tab')) line += '\t'
      else line += '\n'
    }
    if (line.trim()) lines.push(line)
  }
  return lines.join('\n').replace(/[ \t]+\n/g, '\n').trim()
}

/** Da un .docx al suo testo. Vuoto se non è un .docx o non ha un corpo. */
export function docxToText(buffer: Buffer): string {
  const entry = readZip(buffer).find((e) => e.name === 'word/document.xml')
  if (!entry) return ''
  return textFromDocumentXml(entry.data.toString('utf8'))
}
