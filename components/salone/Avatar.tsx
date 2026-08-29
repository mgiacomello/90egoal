'use client'

import { useId } from 'react'
import { ACCONCIATURE, OPACITA_PENNELLO, PELLI, SFONDI, tono, type Look, type Traccia } from './data'

// Disegno vettoriale della modella. Nessun testo: così l'esportazione in PNG
// non dipende dai font e viene identica su tutti i dispositivi.

const W = 320
const H = 400
const CX = 160
const CY = 152
const RX = 68
const RY = 78

function percorso(punti: number[]): string {
  if (punti.length < 4) return ''
  const parti: string[] = [`M${punti[0]},${punti[1]}`]
  for (let i = 2; i < punti.length; i += 2) parti.push(`L${punti[i]},${punti[i + 1]}`)
  return parti.join(' ')
}

function stella(cx: number, cy: number, r: number, punte = 5): string {
  const passi: string[] = []
  for (let i = 0; i < punte * 2; i++) {
    const raggio = i % 2 === 0 ? r : r * 0.45
    const ang = (Math.PI / punte) * i - Math.PI / 2
    passi.push(`${(cx + Math.cos(ang) * raggio).toFixed(1)},${(cy + Math.sin(ang) * raggio).toFixed(1)}`)
  }
  return `M${passi.join(' L')} Z`
}

function cuore(cx: number, cy: number, r: number): string {
  return `M${cx},${cy + r * 0.9} C${cx - r * 1.6},${cy - r * 0.4} ${cx - r * 0.6},${cy - r * 1.5} ${cx},${cy - r * 0.4} C${cx + r * 0.6},${cy - r * 1.5} ${cx + r * 1.6},${cy - r * 0.4} ${cx},${cy + r * 0.9} Z`
}

// Dove finiscono i capelli, in coordinate SVG: serve sia al disegno sia alle
// forbici (il punto toccato sullo schermo diventa la nuova lunghezza).
export const CAPELLI_TOP = 128
export const CAPELLI_FONDO = 332
export const FINE_CAPELLI = (lunghezza: number) =>
  CAPELLI_TOP + (CAPELLI_FONDO - CAPELLI_TOP) * lunghezza

const CIOCCA = (fine: number) =>
  `M84,128 C68,190 62,${fine - 54} 74,${fine - 6} C88,${fine + 14} 118,${fine + 8} 124,${fine - 28} C116,${fine - 80} 112,200 118,136 Z`

const CAPPELLI_FRONTE: Record<string, string> = {
  frangia:
    'M92,152 C92,84 118,58 160,58 C202,58 228,84 228,152 C226,122 216,112 196,122 C176,132 136,132 118,120 C102,110 94,130 92,152 Z',
  riga:
    'M92,152 C92,84 118,58 160,58 C202,58 228,84 228,152 C224,116 206,94 160,90 C114,94 96,116 92,152 Z',
  ciuffo:
    'M92,152 C92,84 118,58 160,58 C202,58 228,84 228,152 C226,120 212,106 188,114 C158,124 118,118 102,136 C97,142 94,147 92,152 Z',
  indietro:
    'M94,148 C96,86 120,60 160,60 C200,60 224,86 226,148 C222,108 200,86 160,86 C120,86 98,108 94,148 Z',
}

const VESTITO_PATH: Record<string, string> = {
  maglietta:
    'M160,246 C134,246 118,254 106,264 C88,278 78,320 76,400 L244,400 C242,320 232,278 214,264 C202,254 186,246 160,246 Z',
  felpa:
    'M160,244 C130,244 112,254 98,266 C78,282 70,322 68,400 L252,400 C250,322 242,282 222,266 C208,254 190,244 160,244 Z',
  abito:
    'M160,246 C136,246 122,254 110,266 C100,278 100,296 104,314 C84,344 68,374 62,400 L258,400 C252,374 236,344 216,314 C220,296 220,278 210,266 C198,254 184,246 160,246 Z',
  tuta:
    'M160,246 C134,246 118,254 106,264 C88,278 78,320 76,400 L244,400 C242,320 232,278 214,264 C202,254 186,246 160,246 Z',
  giacca:
    'M160,246 C132,246 116,254 104,264 C86,278 76,320 74,400 L246,400 C244,320 234,278 216,264 C204,254 188,246 160,246 Z',
  maglione:
    'M160,244 C132,244 114,254 102,266 C84,282 74,322 72,400 L248,400 C246,322 236,282 218,266 C206,254 188,244 160,244 Z',
}

const SCINTILLE: { x: number; y: number; r: number }[] = [
  { x: 108, y: 118, r: 6 },
  { x: 214, y: 104, r: 5 },
  { x: 236, y: 170, r: 6 },
  { x: 84, y: 196, r: 5 },
  { x: 128, y: 220, r: 4 },
  { x: 196, y: 224, r: 5 },
  { x: 60, y: 120, r: 4 },
  { x: 258, y: 232, r: 4 },
]

const LENTIGGINI: { x: number; y: number }[] = [
  { x: 126, y: 180 },
  { x: 136, y: 188 },
  { x: 118, y: 190 },
  { x: 194, y: 180 },
  { x: 184, y: 188 },
  { x: 202, y: 190 },
]

export default function Avatar({
  look,
  guide = false,
  className,
  svgRef,
}: {
  look: Look
  guide?: boolean
  className?: string
  svgRef?: React.Ref<SVGSVGElement>
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const pelle = PELLI.find((p) => p.id === look.pelle) ?? PELLI[0]
  const sfondo = SFONDI.find((s) => s.id === look.sfondo) ?? SFONDI[0]
  const stile = ACCONCIATURE.find((a) => a.id === look.capelli) ?? ACCONCIATURE[0]
  const cap = look.capelliColore
  const capScuro = tono(cap, -0.35)
  const capChiaro = tono(cap, 0.3)
  // Lunghezza: 0.2 = al mento, 1.6 = sotto le spalle. Le forbici la accorciano.
  const lung = stile.allungabile ? Math.max(0.2, Math.min(1.6, look.lunghezza)) : 1
  const conFoto = Boolean(look.foto)

  const idSfondo = `sf-${uid}`
  const idTesta = `testa-${uid}`
  const idBusto = `busto-${uid}`
  const idSfuma = `sfuma-${uid}`
  const pennellate: Traccia[] = Array.isArray(look.pennellate) ? look.pennellate : []

  const fineCiocca = FINE_CAPELLI(lung)

  function capelliDietro() {
    const alone = (
      <ellipse cx={CX} cy={148} rx={RX + 12} ry={RY + 10} fill={cap} />
    )
    switch (stile.back) {
      case 'nessuno':
        return <ellipse cx={CX} cy={146} rx={RX + 5} ry={RY + 4} fill={cap} />
      case 'lunghi':
        return (
          <>
            {alone}
            <path d={CIOCCA(fineCiocca)} fill={cap} />
            <path d={CIOCCA(fineCiocca)} fill={cap} transform="translate(320,0) scale(-1,1)" />
            <path
              d={`M104,170 C96,${fineCiocca - 60} 96,${fineCiocca - 30} 100,${fineCiocca - 14}`}
              stroke={capChiaro}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />
          </>
        )
      case 'caschetto':
        return (
          <>
            {alone}
            <path d={CIOCCA(252)} fill={cap} />
            <path d={CIOCCA(252)} fill={cap} transform="translate(320,0) scale(-1,1)" />
          </>
        )
      case 'coda': {
        const fine = FINE_CAPELLI(lung) - 16
        return (
          <>
            <ellipse cx={CX} cy={144} rx={RX + 6} ry={RY + 4} fill={cap} />
            <ellipse cx={206} cy={116} rx={26} ry={22} fill={cap} />
            <path
              d={`M198,108 C248,100 278,132 270,172 C264,210 250,${fine} 232,${fine + 16} C250,${fine - 26} 254,182 244,152 C234,124 214,116 198,108 Z`}
              fill={cap}
            />
            <path
              d={`M232,126 C256,146 258,176 246,${fine - 30}`}
              stroke={capChiaro}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
              opacity={0.55}
            />
            <circle cx={238} cy={150} r={12} fill="#ff5fa2" />
            <circle cx={238} cy={150} r={5.5} fill={tono('#ff5fa2', 0.4)} />
          </>
        )
      }
      case 'trecce': {
        const nodi = Math.max(2, Math.round(1 + 5 * lung))
        const treccia = (
          <g>
            {Array.from({ length: nodi }).map((_, i) => (
              <ellipse
                key={i}
                cx={80 + (i % 2 === 0 ? 0 : 5)}
                cy={186 + i * 26}
                rx={19 - i * 0.8}
                ry={16}
                fill={i % 2 === 0 ? cap : tono(cap, -0.12)}
              />
            ))}
            <circle cx={82} cy={168} r={12} fill="#ff5fa2" />
          </g>
        )
        return (
          <>
            {alone}
            {treccia}
            <g transform="translate(320,0) scale(-1,1)">{treccia}</g>
          </>
        )
      }
      case 'ricci': {
        const fine = FINE_CAPELLI(lung) - 20
        const riccioli: React.ReactNode[] = []
        for (let i = 0; i < 14; i++) {
          const ang = ((200 - (i / 13) * 220) * Math.PI) / 180
          riccioli.push(
            <circle
              key={`r${i}`}
              cx={CX + Math.cos(ang) * (RX + 12)}
              cy={144 - Math.sin(ang) * (RY + 10)}
              r={20}
              fill={i % 2 === 0 ? cap : tono(cap, -0.1)}
            />,
          )
        }
        for (let i = 0; i < 4; i++) {
          const y = 176 + (i * (fine - 176)) / 3
          riccioli.push(<circle key={`sl${i}`} cx={84 - i * 3} cy={y} r={22} fill={cap} />)
          riccioli.push(<circle key={`sr${i}`} cx={236 + i * 3} cy={y} r={22} fill={cap} />)
        }
        return (
          <>
            <ellipse cx={CX} cy={148} rx={RX + 8} ry={RY + 6} fill={cap} />
            {riccioli}
          </>
        )
      }
      case 'chignon':
        return (
          <>
            <ellipse cx={CX} cy={146} rx={RX + 6} ry={RY + 4} fill={cap} />
            <circle cx={CX} cy={56} r={34} fill={cap} />
            <path
              d="M136,50 C146,34 176,34 186,52"
              stroke={capChiaro}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
              opacity={0.6}
            />
            <rect x={132} y={82} width={56} height={13} rx={6} fill="#ff5fa2" />
          </>
        )
      case 'afro': {
        const nuvola: React.ReactNode[] = []
        for (let i = 0; i < 16; i++) {
          const ang = ((205 - (i / 15) * 230) * Math.PI) / 180
          nuvola.push(
            <circle
              key={i}
              cx={CX + Math.cos(ang) * (RX + 22)}
              cy={148 - Math.sin(ang) * (RY + 20)}
              r={30}
              fill={i % 2 === 0 ? cap : tono(cap, -0.08)}
            />,
          )
        }
        return (
          <>
            <ellipse cx={CX} cy={144} rx={RX + 26} ry={RY + 22} fill={cap} />
            {nuvola}
          </>
        )
      }
      default:
        return alone
    }
  }

  function fantasiaVestito() {
    const chiaro = tono(look.vestitoColore, look.vestitoColore === '#f4f7fb' ? -0.25 : 0.42)
    const elementi: React.ReactNode[] = []
    if (look.fantasia === 'pois') {
      for (let y = 258; y < H; y += 26) {
        for (let x = 52; x < 280; x += 26) {
          elementi.push(<circle key={`${x}-${y}`} cx={x + ((y / 26) % 2) * 13} cy={y} r={5.5} fill={chiaro} />)
        }
      }
    } else if (look.fantasia === 'righe') {
      for (let y = 252; y < H; y += 26) {
        elementi.push(<rect key={y} x={40} y={y} width={240} height={12} fill={chiaro} />)
      }
    } else if (look.fantasia === 'cuori') {
      for (let y = 268; y < H; y += 40) {
        for (let x = 60; x < 280; x += 44) {
          elementi.push(<path key={`${x}-${y}`} d={cuore(x + ((y / 40) % 2) * 22, y, 9)} fill={chiaro} />)
        }
      }
    } else if (look.fantasia === 'stelle') {
      for (let y = 268; y < H; y += 40) {
        for (let x = 60; x < 280; x += 44) {
          elementi.push(<path key={`${x}-${y}`} d={stella(x + ((y / 40) % 2) * 22, y, 10)} fill={chiaro} />)
        }
      }
    }
    return elementi.length ? <g clipPath={`url(#${idBusto})`}>{elementi}</g> : null
  }

  function dettagliVestito() {
    const scuro = tono(look.vestitoColore, -0.28)
    switch (look.vestito) {
      case 'felpa':
        return (
          <>
            <path d="M124,268 C136,300 184,300 196,268" stroke={scuro} strokeWidth={6} fill="none" strokeLinecap="round" />
            <path d="M146,282 L142,318 M174,282 L178,318" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
            <path d="M112,344 L208,344 L204,382 L116,382 Z" fill={scuro} opacity={0.55} />
          </>
        )
      case 'tuta':
        return (
          <>
            <rect x={96} y={276} width={11} height={124} fill="#ffffff" opacity={0.9} />
            <rect x={213} y={276} width={11} height={124} fill="#ffffff" opacity={0.9} />
            <path d="M160,252 L160,400" stroke={scuro} strokeWidth={5} />
          </>
        )
      case 'giacca':
        return (
          <>
            <path d="M160,250 L134,262 L160,320 L186,262 Z" fill="#ffffff" opacity={0.95} />
            <path d="M134,262 L160,320 L128,304 Z" fill={scuro} />
            <path d="M186,262 L160,320 L192,304 Z" fill={scuro} />
            <circle cx={160} cy={336} r={5} fill={tono(look.vestitoColore, 0.5)} />
          </>
        )
      case 'maglione':
        return (
          <>
            <ellipse cx={CX} cy={250} rx={38} ry={15} fill={scuro} />
            <path d="M92,320 L228,320 M92,352 L228,352" stroke={scuro} strokeWidth={4} opacity={0.5} />
          </>
        )
      case 'abito':
        return (
          <>
            <path d="M118,266 C140,292 180,292 202,266" stroke={tono(look.vestitoColore, 0.45)} strokeWidth={6} fill="none" />
            <path d="M104,318 L216,318" stroke={scuro} strokeWidth={5} opacity={0.7} />
          </>
        )
      default:
        return (
          <path d="M132,252 C146,268 174,268 188,252" stroke={scuro} strokeWidth={5} fill="none" strokeLinecap="round" />
        )
    }
  }

  function accessoriTesta() {
    switch (look.testa) {
      case 'corona':
        return (
          <g>
            <path d="M108,92 L108,44 L134,70 L160,32 L186,70 L212,44 L212,92 Z" fill="#ffd24a" stroke="#e0a800" strokeWidth={3} strokeLinejoin="round" />
            <circle cx={160} cy={78} r={7} fill="#ff5fa2" />
            <circle cx={124} cy={82} r={5} fill="#5ec8e5" />
            <circle cx={196} cy={82} r={5} fill="#5ec8e5" />
          </g>
        )
      case 'cerchietto':
        return (
          <g>
            <path d="M96,140 C100,74 130,52 160,52 C190,52 220,74 224,140" stroke="#ff5fa2" strokeWidth={11} fill="none" strokeLinecap="round" />
            <path d="M212,66 C230,50 246,58 240,74 C252,72 256,90 238,94 C226,96 214,84 212,66 Z" fill="#ff5fa2" />
            <circle cx={232} cy={76} r={6} fill={tono('#ff5fa2', 0.45)} />
          </g>
        )
      case 'cappello':
        return (
          <g>
            <path d="M94,98 C94,52 122,28 160,28 C198,28 226,52 226,98 Z" fill="#3f51b5" />
            <path d="M94,98 C70,100 54,110 50,124 C92,132 132,120 160,110 C132,108 108,104 94,98 Z" fill={tono('#3f51b5', -0.25)} />
            <circle cx={160} cy={30} r={9} fill="#ffd24a" />
          </g>
        )
      case 'fiore':
        return (
          <g transform="translate(104,92)">
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse
                key={i}
                cx={Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 15}
                cy={Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 15}
                rx={11}
                ry={13}
                fill="#ff8fc7"
                transform={`rotate(${(i * 360) / 5} ${Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 15} ${Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 15})`}
              />
            ))}
            <circle cx={0} cy={0} r={9} fill="#ffd24a" />
          </g>
        )
      default:
        return null
    }
  }

  function occhialiSvg() {
    if (look.occhiali === 'nessuno') return null
    const scuri = look.occhiali === 'sole'
    return (
      <g>
        <rect x={110} y={144} width={46} height={34} rx={13} fill={scuri ? '#2b2f38' : '#ffffff'} fillOpacity={scuri ? 0.92 : 0.18} stroke="#2b2f38" strokeWidth={4} />
        <rect x={164} y={144} width={46} height={34} rx={13} fill={scuri ? '#2b2f38' : '#ffffff'} fillOpacity={scuri ? 0.92 : 0.18} stroke="#2b2f38" strokeWidth={4} />
        <path d="M156,158 L164,158" stroke="#2b2f38" strokeWidth={4} />
        <path d="M110,156 L94,162 M210,156 L226,162" stroke="#2b2f38" strokeWidth={4} strokeLinecap="round" />
      </g>
    )
  }

  const occhio = (cx: number) => (
    <g>
      <ellipse cx={cx} cy={160} rx={15} ry={12} fill="#ffffff" />
      <circle cx={cx} cy={161} r={8} fill={look.occhi} />
      <circle cx={cx} cy={161} r={3.6} fill="#141414" />
      <circle cx={cx + 3} cy={157} r={2.6} fill="#ffffff" />
      <path
        d={`M${cx - 15},159 A15,12 0 0 1 ${cx + 15},159`}
        stroke="#2b2119"
        strokeWidth={look.ciglia ? 4 : 2.5}
        fill="none"
        strokeLinecap="round"
      />
      {look.ciglia && (
        <path
          d={`M${cx + 14},152 l7,-5 M${cx + 15},158 l8,-1 M${cx - 14},152 l-7,-5`}
          stroke="#2b2119"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Ritratto di ${look.nome || 'modella'}`}
    >
      <defs>
        <linearGradient id={idSfondo} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sfondo.da} />
          <stop offset="100%" stopColor={sfondo.a} />
        </linearGradient>
        <filter id={idSfuma} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id={idTesta}>
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} />
        </clipPath>
        <clipPath id={idBusto}>
          <path d={VESTITO_PATH[look.vestito]} />
        </clipPath>
      </defs>

      <rect width={W} height={H} fill={`url(#${idSfondo})`} />
      {sfondo.stelle && (
        <g fill="#ffffff" opacity={0.8}>
          {[
            [40, 60, 7], [280, 48, 6], [252, 110, 5], [56, 150, 5], [292, 200, 6], [30, 250, 5],
          ].map(([x, y, r], i) => (
            <path key={i} d={stella(x, y, r)} />
          ))}
        </g>
      )}
      <ellipse cx={CX} cy={392} rx={130} ry={26} fill="#000000" opacity={0.06} />

      {/* capelli dietro */}
      {capelliDietro()}

      {/* collo e busto */}
      <path d="M138,206 L182,206 L182,252 C182,262 138,262 138,252 Z" fill={pelle.base} />
      <path d="M138,206 L182,206 L182,224 C168,236 150,236 138,226 Z" fill={pelle.ombra} opacity={0.7} />
      <path d={VESTITO_PATH[look.vestito]} fill={look.vestitoColore} />
      {fantasiaVestito()}
      {dettagliVestito()}

      {look.collana && (
        <g>
          <path d="M132,254 C144,278 176,278 188,254" stroke="#ffd24a" strokeWidth={4} fill="none" />
          <circle cx={160} cy={274} r={8} fill="#ff5fa2" stroke="#ffd24a" strokeWidth={3} />
        </g>
      )}

      {/* orecchie */}
      {!conFoto && (
        <>
          <ellipse cx={94} cy={166} rx={11} ry={15} fill={pelle.base} />
          <ellipse cx={226} cy={166} rx={11} ry={15} fill={pelle.base} />
        </>
      )}
      {look.orecchini && (
        <>
          <circle cx={94} cy={186} r={7} fill="#ffd24a" stroke="#e0a800" strokeWidth={2} />
          <circle cx={226} cy={186} r={7} fill="#ffd24a" stroke="#e0a800" strokeWidth={2} />
        </>
      )}

      {/* testa: pelle disegnata oppure la foto caricata */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill={pelle.base} />
      {conFoto && (
        <g clipPath={`url(#${idTesta})`}>
          <rect x={CX - RX} y={CY - RY} width={RX * 2} height={RY * 2} fill="#ffffff" />
          <image
            href={look.foto ?? ''}
            x={CX - RX}
            y={CY - RY}
            width={RX * 2}
            height={RY * 2}
            preserveAspectRatio="xMidYMid slice"
            transform={`translate(${CX + look.fotoX} ${CY + look.fotoY}) rotate(${look.fotoRot}) scale(${look.fotoZoom}) translate(${-CX} ${-CY})`}
          />
        </g>
      )}

      {/* viso disegnato (solo senza foto) */}
      {!conFoto && (
        <>
          <ellipse cx={CX} cy={CY + 22} rx={RX - 6} ry={RY - 14} fill={pelle.base} />
          <path d="M118,134 C126,124 144,123 152,130" stroke={tono(cap, -0.2)} strokeWidth={6} strokeLinecap="round" fill="none" />
          <path d="M202,134 C194,124 176,123 168,130" stroke={tono(cap, -0.2)} strokeWidth={6} strokeLinecap="round" fill="none" />
          {occhio(134)}
          {occhio(186)}
          <path d="M156,176 C152,186 156,190 162,189" stroke={pelle.ombra} strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      )}

      {/* trucco: funziona sia sul viso disegnato sia sulla foto */}
      {look.fard && (
        <g opacity={conFoto ? 0.45 : 0.6}>
          <ellipse cx={120} cy={186} rx={17} ry={11} fill={look.fard} />
          <ellipse cx={200} cy={186} rx={17} ry={11} fill={look.fard} />
        </g>
      )}
      {look.ombretto && (
        <g opacity={conFoto ? 0.5 : 0.75}>
          <path d="M119,152 C124,138 144,138 149,150 C142,144 126,144 119,152 Z" fill={look.ombretto} />
          <path d="M171,150 C176,138 196,138 201,152 C194,144 178,144 171,150 Z" fill={look.ombretto} />
        </g>
      )}
      {look.rossetto ? (
        <g opacity={conFoto ? 0.6 : 1}>
          <path d={`M140,198 C150,190 170,190 180,198 C172,214 148,214 140,198 Z`} fill={look.rossetto} />
          <path d="M148,197 C156,193 164,193 172,197" stroke={tono(look.rossetto, 0.45)} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      ) : (
        !conFoto && (
          <path d="M142,196 C152,208 168,208 178,196" stroke="#c2605c" strokeWidth={5} fill="none" strokeLinecap="round" />
        )
      )}
      {look.lentiggini && !conFoto && (
        <g fill={pelle.ombra} opacity={0.85}>
          {LENTIGGINI.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.4} />
          ))}
        </g>
      )}

      {/* trucco dato col dito: resta dentro la sagoma del viso */}
      {pennellate.length > 0 && (
        <g clipPath={`url(#${idTesta})`}>
          {pennellate.map((t) =>
            t.tipo === 'glitter' ? (
              <g key={t.id} fill={t.colore}>
                {Array.from({ length: Math.floor(t.punti.length / 2) }).map((_, i) =>
                  i % 2 === 0 ? (
                    <path
                      key={i}
                      d={stella(t.punti[i * 2], t.punti[i * 2 + 1], 4 + ((i * 7) % 3), 4)}
                      opacity={0.7 + ((i * 3) % 3) * 0.1}
                    />
                  ) : null,
                )}
              </g>
            ) : (
              <path
                key={t.id}
                d={percorso(t.punti)}
                stroke={t.colore}
                strokeWidth={t.spessore}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={OPACITA_PENNELLO[t.tipo]}
                filter={t.tipo === 'fard' ? `url(#${idSfuma})` : undefined}
              />
            ),
          )}
        </g>
      )}

      {/* capelli davanti */}
      {stile.back !== 'afro' && stile.back !== 'ricci' && (
        <>
          <path d={CAPPELLI_FRONTE[stile.cap]} fill={cap} />
          <path
            d="M116,102 C132,86 160,80 184,88"
            stroke={capChiaro}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            opacity={0.45}
          />
          <path d={CAPPELLI_FRONTE[stile.cap]} fill={capScuro} opacity={0.12} />
        </>
      )}
      {(stile.back === 'afro' || stile.back === 'ricci') && (
        <path d={CAPPELLI_FRONTE[stile.cap]} fill={cap} />
      )}

      {look.lucidi && (
        <g pointerEvents="none">
          <path
            d="M114,112 C132,90 158,80 184,86"
            stroke="#ffffff"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
            opacity={0.45}
          />
          <path
            d="M218,140 C226,164 226,192 218,214"
            stroke="#ffffff"
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
            opacity={0.25}
          />
          <g fill="#ffffff" opacity={0.9}>
            <path d={stella(120, 96, 6, 4)} />
            <path d={stella(206, 108, 5, 4)} />
            <path d={stella(96, 168, 4, 4)} />
          </g>
        </g>
      )}

      {occhialiSvg()}
      {accessoriTesta()}

      {look.glitter && (
        <g fill="#ffffff">
          {SCINTILLE.map((s, i) => (
            <path key={i} d={stella(s.x, s.y, s.r, 4)} opacity={0.55 + (i % 3) * 0.15} />
          ))}
          <path d={stella(242, 210, 5, 4)} fill="#ffd24a" opacity={0.9} />
        </g>
      )}

      {/* guide per centrare la foto */}
      {guide && (
        <g fill="none" stroke="#ff2d87" strokeWidth={2.5} strokeDasharray="7 6" opacity={0.9}>
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} />
          <ellipse cx={134} cy={160} rx={16} ry={12} />
          <ellipse cx={186} cy={160} rx={16} ry={12} />
          <path d="M140,198 C152,208 168,208 180,198" />
        </g>
      )}
    </svg>
  )
}
