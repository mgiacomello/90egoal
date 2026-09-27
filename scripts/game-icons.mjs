// Icone PWA di 90 & Goal, senza dipendenze: "90" disegnato a mano su fondo verde.
// Rieseguibile con `npm run game:icons`. Scrive in public/icons/.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

// Coordinate in una griglia 100×100.
const INK = [4, 19, 11]
function inGlyph(u, v) {
  // "9": anello in alto + gamba a destra con estremità arrotondata
  const d9 = Math.hypot(u - 33, v - 43)
  if (d9 <= 14 && d9 >= 6.5) return true
  if (u >= 39.5 && u <= 47 && v >= 43 && v <= 66.25) return true
  if (Math.hypot(u - 43.25, v - 66.25) <= 3.75) return true
  // "0": ellisse ad anello
  const e1 = ((u - 68) / 14) ** 2 + ((v - 50) / 20) ** 2
  const e2 = ((u - 68) / 6.5) ** 2 + ((v - 50) / 12.5) ** 2
  return e1 <= 1 && e2 >= 1
}
function inRounded(u, v, r) {
  const cx = Math.min(Math.max(u, r), 100 - r)
  const cy = Math.min(Math.max(v, r), 100 - r)
  return Math.hypot(u - cx, v - cy) <= r
}
function bg(u, v) {
  const t = (u + v) / 200
  return [26 + (0 - 26) * t, 255 + (200 - 255) * t, 140 + (83 - 140) * t]
}

function draw(size, { rounded }) {
  const SS = 4
  return png(size, (x, y) => {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = ((x + (sx + 0.5) / SS) / size) * 100
      const v = ((y + (sy + 0.5) / SS) / size) * 100
      if (rounded && !inRounded(u, v, 22)) continue
      const c = inGlyph(u, v) ? INK : bg(u, v)
      r += c[0]; g += c[1]; b += c[2]; a += 255
    }
    const n = SS * SS
    return a === 0 ? [0, 0, 0, 0] : [Math.round(r / (a / 255)), Math.round(g / (a / 255)), Math.round(b / (a / 255)), Math.round(a / n)]
  })
}

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'icon-192.png'), draw(192, { rounded: true }))
writeFileSync(resolve(OUT, 'icon-512.png'), draw(512, { rounded: true }))
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), draw(512, { rounded: false }))
writeFileSync(resolve(OUT, 'apple-touch-icon.png'), draw(180, { rounded: false }))
// Badge per la barra di stato di Android: solo sagoma, bianco su trasparente.
writeFileSync(resolve(OUT, 'badge-96.png'), png(96, (x, y) => {
  const SS = 4
  let hit = 0
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
    if (inGlyph(((x + (sx + 0.5) / SS) / 96) * 100, ((y + (sy + 0.5) / SS) / 96) * 100)) hit++
  }
  return [255, 255, 255, Math.round((hit / (SS * SS)) * 255)]
}))
console.log('Icone scritte in', OUT)
