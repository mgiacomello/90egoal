// Genera le icone PWA di ONE TAP senza dipendenze: encoder PNG minimale.
// Rieseguibile con `node scripts/onetap-icons.mjs`.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/onetap')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filtro "none"
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Il segno: un bersaglio: anello sottile, punto pieno al centro.
// Fondo pieno fino ai bordi, così funziona anche come icona "maskable".
function icon(x, y, size) {
  const cx = size / 2 - 0.5
  const cy = size / 2 - 0.5
  const d = Math.hypot(x - cx, y - cy)

  const ringR = size * 0.3
  const ringW = size * 0.052
  const dotR = size * 0.108

  const aa = (edge, value) => Math.max(0, Math.min(1, edge - value + 0.5))

  const dot = aa(dotR, d)
  const ring = Math.min(aa(ringR + ringW / 2, d), 1 - aa(ringR - ringW / 2, d))
  const ink = Math.max(dot, ring)

  // gradiente di fondo dal viola profondo al nero
  const t = (x + y) / (2 * size)
  const bg = [Math.round(16 + 12 * (1 - t)), Math.round(12 + 6 * (1 - t)), Math.round(24 + 26 * (1 - t))]

  return [
    Math.round(bg[0] + (255 - bg[0]) * ink),
    Math.round(bg[1] + (255 - bg[1]) * ink),
    Math.round(bg[2] + (255 - bg[2]) * ink),
    255,
  ]
}

mkdirSync(OUT, { recursive: true })
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
  writeFileSync(resolve(OUT, name), png(size, icon))
  console.log('scritta', name)
}
