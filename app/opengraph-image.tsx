import { ImageResponse } from 'next/og'

// L'anteprima del link quando gira su WhatsApp: la tessera "90", il titolo, sei minuti con due accesi.
export const runtime = 'edge'
export const alt = '90 & Goal — Indovina il minuto del gol'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#0b2219'
const SURFACE = '#123127'
const LIME = '#c8ff3e'
const INK = '#f4f6ee'
const MUTED = '#9fb5a8'

export default function Image() {
  const tessere: { m: number; hit?: boolean }[] = [{ m: 12 }, { m: 27, hit: true }, { m: 44 }, { m: 61, hit: true }, { m: 78 }, { m: 89 }]
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: `linear-gradient(180deg, ${BG} 0%, #071a12 100%)`, color: INK, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 18, background: LIME, color: BG, fontSize: 36, fontWeight: 800 }}>90</div>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, letterSpacing: 1 }}><span style={{ opacity: 0.5 }}>&amp;</span>GOAL</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 108, fontWeight: 800, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: -2 }}>Indovina il minuto</div>
          <div style={{ display: 'flex', fontSize: 108, fontWeight: 800, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: -2, color: LIME }}>del gol</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {tessere.map(t => (
              <div key={t.m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 112, height: 84, borderRadius: 18, fontSize: 44, fontWeight: 700, background: t.hit ? LIME : SURFACE, color: t.hit ? BG : INK, border: `2px solid ${t.hit ? LIME : 'rgba(244,246,238,0.12)'}` }}>{t.m}</div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>Serie A · B · C</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
