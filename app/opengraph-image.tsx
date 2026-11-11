import { ImageResponse } from 'next/og'

// L'anteprima del link quando gira su WhatsApp: la tessera "90", il titolo, sei minuti con due accesi.
export const runtime = 'edge'
export const alt = '90 & Goal — Indovina il minuto del gol'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#eef3fb'
const SURFACE = '#ffffff'
const LIME = '#1d4fd7'
const INK = '#0b1f4d'
const MUTED = '#5b6b8c'

export default function Image() {
  const tessere: { m: number; hit?: boolean }[] = [{ m: 12 }, { m: 27, hit: true }, { m: 44 }, { m: 61, hit: true }, { m: 78 }, { m: 89 }]
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(180deg, #dbe7ff 0%, #eef3fb 45%)', color: INK, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 18, background: LIME, color: '#ffffff', fontSize: 34, fontWeight: 800 }}>90</div>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 600 }}><span style={{ color: MUTED }}>&amp;&nbsp;</span>Goal</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1.0, letterSpacing: -2 }}>Indovina il minuto</div>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1.0, letterSpacing: -2, color: LIME }}>del gol</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {tessere.map(t => (
              <div key={t.m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 112, height: 84, borderRadius: 18, fontSize: 40, fontWeight: 600, fontFamily: 'monospace', background: t.hit ? LIME : SURFACE, color: t.hit ? '#ffffff' : INK, border: `2px solid ${t.hit ? LIME : 'rgba(11,31,77,0.1)'}` }}>{t.m}</div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>Serie A · B · C</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
