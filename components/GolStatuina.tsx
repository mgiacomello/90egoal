'use client'

import { useEffect, useRef } from 'react'
import type * as THREE_NS from 'three'
import { magliaDi, parseMarcatore, type Maglia } from '@/lib/kits'

// La statuina che festeggia il gol: un calciatore in 3D, non una persona reale.
// Ceramica smaltata per la pelle, tessuto per la divisa, niente volto: è una statuina.
// Tre esultanze animate per pose chiave (non oscillazioni): la stessa per lo stesso gol.
// Si gira col dito. Con "riduci movimento" resta ferma nella posa più bella.

export type Esultanza = 'aeroplano' | 'pugno' | 'scivolata'

export function esultanzaPer(seme: string): Esultanza {
  let h = 0
  for (let i = 0; i < seme.length; i++) h = (h * 31 + seme.charCodeAt(i)) >>> 0
  return (['aeroplano', 'pugno', 'scivolata'] as const)[h % 3]
}

const ARGILLA = '#e9dcc4'
const CAPELLI = '#2f2a26'
const SCARPE = '#151517'
const BASE = '#0b1f4d'      // il piedistallo: blu notte laccato
const ARANCIO = '#3b6cf0'   // (nome storico) il blu acceso: anelli, filo, coriandoli

interface Props {
  team: string
  marcatore?: string
  esultanza: Esultanza
  // La foto del marcatore già ritagliata (o a cartoncino): se c'è, la statuina è la foto.
  foto?: HTMLCanvasElement | null
  className?: string
}

export default function GolStatuina({ team, marcatore, esultanza, foto, className = '' }: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let vivo = true
    let pulizia = () => {}
    Promise.all([import('three'), import('three/examples/jsm/environments/RoomEnvironment.js')]).then(([THREE, env]) => {
      if (!vivo || !host.current) return
      pulizia = monta(THREE, env.RoomEnvironment, el, magliaDi(team), parseMarcatore(marcatore ?? ''), esultanza, foto ?? null)
    })
    return () => { vivo = false; pulizia() }
  }, [team, marcatore, esultanza, foto])

  return <div ref={host} className={`relative touch-none select-none ${className}`} aria-label={`Statuina di un calciatore con la maglia ${team} che esulta`} role="img" />
}

type T = typeof THREE_NS

/* ------------------------------------------------------------------ *
 * Pose: un insieme di angoli dei giunti. I tasti mancanti valgono 0.
 * ------------------------------------------------------------------ */
type Chiave =
  | 'x' | 'y' | 'z' | 'ry'          // radice: posizione sul piedistallo e direzione
  | 'pel'                           // quanto si abbassa il bacino
  | 'spX' | 'spY' | 'spZ'           // schiena: avanti/indietro, torsione, fianco
  | 'hdX' | 'hdY' | 'hdZ'           // testa
  | 'sLx' | 'sLy' | 'sLz' | 'eL'    // spalla e gomito sinistri
  | 'sRx' | 'sRy' | 'sRz' | 'eR'    // spalla e gomito destri
  | 'hLx' | 'hLz' | 'kL' | 'aL'     // anca, ginocchio, caviglia sinistri
  | 'hRx' | 'hRz' | 'kR' | 'aR'
type Posa = Partial<Record<Chiave, number>>
type Traccia = [number, Posa][]

const CHIAVI: Chiave[] = ['x', 'y', 'z', 'ry', 'pel', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'hdZ', 'sLx', 'sLy', 'sLz', 'eL', 'sRx', 'sRy', 'sRz', 'eR', 'hLx', 'hLz', 'kL', 'aL', 'hRx', 'hRz', 'kR', 'aR']

// Interpolazione morbida fra pose chiave (entra e esce piano, come un corpo vero).
const dolce = (u: number) => u * u * u * (u * (u * 6 - 15) + 10)
function campiona(tr: Traccia, t: number): Posa {
  const durata = tr[tr.length - 1][0]
  const tt = ((t % durata) + durata) % durata
  let i = 0
  while (i < tr.length - 2 && tr[i + 1][0] <= tt) i++
  const [t0, a] = tr[i]
  const [t1, b] = tr[i + 1]
  const u = dolce(Math.min(1, Math.max(0, (tt - t0) / (t1 - t0 || 1))))
  const out: Posa = {}
  for (const k of CHIAVI) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * u
  return out
}
function somma(p: Posa, q: Posa, peso = 1): Posa {
  const out: Posa = { ...p }
  for (const k of Object.keys(q) as Chiave[]) out[k] = (out[k] ?? 0) + (q[k] ?? 0) * peso
  return out
}

// Ciclo di corsa: fase in radianti, ampiezza 0..1. Anca avanti = x negativo, ginocchio piegato = positivo.
function corsa(f: number, amp = 1): Posa {
  const s = Math.sin(f)
  return {
    y: 0.045 * amp * Math.abs(Math.cos(f)),
    hLx: -0.75 * amp * s, hRx: 0.75 * amp * s,
    kL: amp * (0.25 + 1.05 * Math.max(0, Math.sin(f + 1.9))),
    kR: amp * (0.25 + 1.05 * Math.max(0, Math.sin(f + 1.9 + Math.PI))),
    aL: -0.2 * amp * s, aR: 0.2 * amp * s,
    spX: 0.18 * amp, spY: 0.12 * amp * s,
    sLx: 0.65 * amp * s, sRx: -0.65 * amp * s,
    eL: -1.2 * amp, eR: -1.2 * amp,
  }
}

const RIPOSO: Posa = { sLz: -0.12, sRz: 0.12, eL: -0.15, eR: -0.15 }

// Salto con il pugno al cielo, due colpi di pugno, si ricomincia.
const PUGNO: Traccia = [
  [0.0, RIPOSO],
  [0.35, { pel: 0.13, hLx: -0.55, hRx: -0.55, kL: 1.05, kR: 1.05, aL: -0.45, aR: -0.45, spX: 0.42, hdX: 0.15, sLx: 0.55, sRx: 0.55, sLz: -0.2, sRz: 0.2, eL: -0.3, eR: -0.3 }],
  [0.62, { y: 0.42, hLx: -1.0, kL: 1.5, hRx: 0.15, kR: 0.35, aR: 0.3, spX: -0.22, hdX: -0.5, sRz: 2.95, eR: -0.1, sLx: -0.7, sLz: -0.45, eL: -1.7 }],
  [0.88, { pel: 0.16, hLx: -0.55, hRx: -0.5, kL: 1.1, kR: 1.05, aL: -0.5, aR: -0.5, spX: 0.3, hdX: -0.1, sRz: 2.6, eR: -0.3, sLx: -0.5, sLz: -0.5, eL: -1.4 }],
  [1.2, { pel: 0.02, hLx: -0.05, kL: 0.1, spX: -0.08, hdX: -0.35, sRz: 2.95, eR: -0.15, sLx: -0.45, sLz: -0.35, eL: -1.3 }],
  [1.45, { pel: 0.05, kL: 0.15, kR: 0.15, spX: 0.15, hdX: -0.1, sRz: 2.1, sRx: -0.3, eR: -1.6, sLx: -0.45, sLz: -0.35, eL: -1.3 }],
  [1.7, { pel: 0.02, spX: -0.1, hdX: -0.4, sRz: 2.95, eR: -0.12, sLx: -0.45, sLz: -0.35, eL: -1.3 }],
  [1.95, { pel: 0.05, kL: 0.15, kR: 0.15, spX: 0.15, hdX: -0.1, sRz: 2.1, sRx: -0.3, eR: -1.6, sLx: -0.45, sLz: -0.35, eL: -1.3 }],
  [2.25, { spX: -0.05, hdX: -0.3, sRz: 2.7, eR: -0.3, sLz: -0.4, eL: -0.6 }],
  [2.8, RIPOSO],
]

// Corsa, scivolata in ginocchio, schiena indietro e braccia al cielo; si rialza e torna al via.
const STRIDE_A: Posa = { z: -0.5, y: 0.03, hLx: -0.6, kL: 0.35, hRx: 0.55, kR: 1.0, sLx: 0.55, sRx: -0.55, eL: -1.1, eR: -1.1, spX: 0.22 }
const SCIVOLATA: Traccia = [
  [0.0, STRIDE_A],
  [0.28, { z: -0.33, y: 0.05, hRx: -0.6, kR: 0.35, hLx: 0.55, kL: 1.0, sRx: 0.55, sLx: -0.55, eL: -1.1, eR: -1.1, spX: 0.22 }],
  [0.56, { z: -0.16, y: 0.02, pel: 0.28, hLx: 0.1, kL: 1.45, hRx: -0.35, kR: 1.35, spX: -0.05, sLz: -1.25, sRz: 1.25, eL: -0.3, eR: -0.3 }],
  [0.85, { z: 0.06, pel: 0.47, hLx: -0.08, hRx: -0.08, hLz: -0.16, hRz: 0.16, kL: 1.68, kR: 1.68, aL: 0.6, aR: 0.6, spX: -0.38, hdX: -0.35, sLz: -2.25, sRz: 2.25, eL: -0.2, eR: -0.2 }],
  [1.7, { z: 0.26, pel: 0.47, hLx: -0.08, hRx: -0.08, hLz: -0.16, hRz: 0.16, kL: 1.68, kR: 1.68, aL: 0.6, aR: 0.6, spX: -0.6, hdX: -0.65, sLz: -2.7, sRz: 2.7, sLx: 0.15, sRx: 0.15, eL: -0.1, eR: -0.1 }],
  [3.4, { z: 0.26, pel: 0.47, hLx: -0.08, hRx: -0.08, hLz: -0.16, hRz: 0.16, kL: 1.68, kR: 1.68, aL: 0.6, aR: 0.6, spX: -0.55, hdX: -0.55, sLz: -2.75, sRz: 2.75, sLx: 0.2, sRx: 0.2, eL: -0.15, eR: -0.15 }],
  [4.0, { z: 0.26, pel: 0.27, hLx: -0.95, kL: 1.45, aL: 0.1, hRx: 0.05, kR: 1.65, aR: 0.6, spX: 0.25, hdX: -0.1, sLz: -0.6, sRz: 0.6, eL: -0.4, eR: -0.4 }],
  [4.6, { z: 0.26, sLz: -0.35, sRz: 0.35, hdX: -0.2, eL: -0.3, eR: -0.3 }],
  [5.9, { z: -0.5, sLz: -0.2, sRz: 0.2, eL: -0.3, eR: -0.3 }],
  [6.3, STRIDE_A],
]

function posaPer(esultanza: Esultanza, t: number): Posa {
  let p: Posa
  if (esultanza === 'aeroplano') {
    // Corre in tondo sul piedistallo a braccia larghe, piegato verso il centro come un aereo in virata.
    const r = 0.36, a = t * 1.25
    const ala = Math.sin(t * 2.1)
    p = somma({
      x: Math.sin(a) * r, z: Math.cos(a) * r, ry: a + Math.PI / 2,
      spZ: 0.32 + ala * 0.12, hdX: -0.25, hdZ: -0.15,
      sLz: -1.5 + ala * 0.18, sRz: 1.5 + ala * 0.18, sLy: 0.15, sRy: -0.15, eL: -0.08, eR: -0.08,
    }, { ...corsa(t * 9.5, 0.9), sLx: 0, sRx: 0, eL: 0, eR: 0 })
  } else if (esultanza === 'pugno') {
    p = campiona(PUGNO, t)
    p.ry = (p.ry ?? 0) + Math.sin(t * 0.55) * 0.45
  } else {
    p = campiona(SCIVOLATA, t)
    const tt = t % 6.3
    // Durante il ritorno (4.6–5.9) cammina all'indietro: passi piccoli sopra la posa chiave.
    if (tt > 4.6 && tt < 5.9) {
      const w = Math.sin(Math.PI * (tt - 4.6) / 1.3)
      p = somma(p, { ...corsa(tt * 8, 0.45), sLx: 0, sRx: 0, eL: 0, eR: 0, spX: 0 }, w)
    }
  }
  // Respiro: sempre, poco.
  p.spX = (p.spX ?? 0) + Math.sin(t * 2.3) * 0.02
  return p
}

/* ------------------------------------------------------------------ */

function monta(THREE: T, RoomEnvironment: new () => THREE_NS.Scene, el: HTMLDivElement, kit: Maglia, chi: { nome: string; numero: string }, esultanza: Esultanza, foto: HTMLCanvasElement | null): () => void {
  const w = el.clientWidth || 320
  const h = el.clientHeight || 360
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // Riflessi morbidi da studio: fanno sembrare smaltata la ceramica e vivo il tessuto.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = ambiente
  scene.environmentIntensity = 0.55

  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50)
  camera.position.set(0, 1.25, 5.4)
  camera.lookAt(0, 0.82, 0)

  const chiave = new THREE.DirectionalLight('#fff1dc', 2.4)
  chiave.position.set(2.2, 4.8, 3.2)
  chiave.castShadow = true
  chiave.shadow.mapSize.set(1024, 1024)
  chiave.shadow.camera.left = -1.6; chiave.shadow.camera.right = 1.6
  chiave.shadow.camera.top = 2.4; chiave.shadow.camera.bottom = -0.6
  chiave.shadow.camera.near = 1; chiave.shadow.camera.far = 12
  chiave.shadow.radius = 5
  chiave.shadow.bias = -0.0005
  scene.add(chiave)
  const taglio = new THREE.DirectionalLight('#d8e8ff', 1.6)
  taglio.position.set(-3, 2.5, -2.5)
  scene.add(taglio)
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d6f2', 0.45))

  const tutto = new THREE.Group()
  scene.add(tutto)

  // ---- Materiali
  const ceramica = (color: string) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 })
  const tessuto = (opts: { color?: string; map?: THREE_NS.Texture }) => new THREE.MeshPhysicalMaterial({
    ...opts, roughness: 0.78, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.35),
  })
  const mMaglia = tessuto({ map: trama(THREE, kit) })
  const mSecondo = tessuto({ color: kit.motivo === 'tinta' ? kit.secondo : kit.secondo })
  const mManica = tessuto({ color: kit.motivo === 'tinta' ? kit.maglia : kit.secondo })
  const mPelle = ceramica(ARGILLA)
  const mCalzoncini = tessuto({ color: kit.calzoncini })
  const mCalze = tessuto({ color: kit.calzettoni })
  const mScarpe = new THREE.MeshPhysicalMaterial({ color: SCARPE, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 })
  const mCapelli = new THREE.MeshPhysicalMaterial({ color: CAPELLI, roughness: 0.6, clearcoat: 0.3 })

  // ---- Il piedistallo: inchiostro laccato con un filo d'arancio.
  const piedistallo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.98, 1.06, 0.22, 96),
    new THREE.MeshPhysicalMaterial({ color: BASE, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  )
  piedistallo.position.y = -0.11
  piedistallo.receiveShadow = true
  tutto.add(piedistallo)
  const filo = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.014, 10, 128), ceramica(ARANCIO))
  filo.rotation.x = Math.PI / 2
  filo.position.y = -0.005
  tutto.add(filo)
  // L'onda: un anello arancio che si allarga dal piedistallo e svanisce, tre volte, all'inizio.
  const ondaMat = new THREE.MeshBasicMaterial({ color: ARANCIO, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  const onda = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.02, 96), ondaMat)
  onda.rotation.x = -Math.PI / 2
  onda.position.y = 0.012
  tutto.add(onda)
  const festa = (t: number) => {
    const ciclo = 1.1
    const n = Math.floor(t / ciclo)
    const u = (t % ciclo) / ciclo
    if (n < 3) { onda.scale.setScalar(1 + u * 0.9); ondaMat.opacity = (1 - u) * 0.9 }
    else ondaMat.opacity = 0
    // Lampo dei riflettori nel primo mezzo secondo.
    chiave.intensity = 2.4 + Math.max(0, 1 - t / 0.5) * 3
  }

  const pezzo = (geo: THREE_NS.BufferGeometry, m: THREE_NS.Material) => {
    const x = new THREE.Mesh(geo, m)
    x.castShadow = true
    x.receiveShadow = true
    return x
  }
  const segmento = (r: number, lung: number, m: THREE_NS.Material, rFondo = r) => {
    // Un cilindro con le estremità tonde, appeso al suo giunto.
    const g = new THREE.Group()
    const corpo = pezzo(new THREE.CylinderGeometry(r, rFondo, lung, 20), m)
    corpo.position.y = -lung / 2
    g.add(corpo)
    const cima = pezzo(new THREE.SphereGeometry(r, 20, 12), m)
    g.add(cima)
    const fondo = pezzo(new THREE.SphereGeometry(rFondo, 20, 12), m)
    fondo.position.y = -lung
    g.add(fondo)
    return g
  }

  // ---- Il corpo: la statuina fotografica (se c'è la foto) o la statuina d'argilla.
  const anima: (t: number) => void = foto ? statuinaFoto(foto) : statuinaArgilla()

  function statuinaFoto(sagoma: HTMLCanvasElement): (t: number) => void {
    // La foto ritagliata in piedi sul piedistallo, come un cartonato: davanti il giocatore,
    // dietro il cartoncino della squadra con nome e numero (si vede quando gira su sé stessa).
    const altezza = 1.9
    const larghezza = altezza * (sagoma.width / sagoma.height)
    const lato = Math.min(larghezza, 1.7)
    const scala = lato / larghezza
    const H = altezza * scala, W = larghezza * scala
    const davantiTex = new THREE.CanvasTexture(sagoma)
    davantiTex.colorSpace = THREE.SRGBColorSpace
    davantiTex.anisotropy = 8
    const perno = new THREE.Group()        // ruota attorno ai piedi: schiaccia e allunga da lì
    tutto.add(perno)
    const davanti = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({ map: davantiTex, transparent: true, alphaTest: 0.08, roughness: 0.55, side: THREE.FrontSide }),
    )
    davanti.position.y = H / 2
    davanti.castShadow = true
    perno.add(davanti)
    // Il retro: la stessa sagoma piena nei colori della maglia, con nome e numero.
    const retroCanvas = document.createElement('canvas')
    retroCanvas.width = sagoma.width; retroCanvas.height = sagoma.height
    const rg = retroCanvas.getContext('2d')!
    rg.drawImage(sagoma, 0, 0)
    rg.globalCompositeOperation = 'source-in'
    rg.fillStyle = kit.maglia
    rg.fillRect(0, 0, retroCanvas.width, retroCanvas.height)
    rg.globalCompositeOperation = 'source-atop'
    rg.fillStyle = kit.numero
    rg.textAlign = 'center'; rg.textBaseline = 'middle'
    const cx = retroCanvas.width / 2, cy = retroCanvas.height * 0.45
    if (chi.nome) { rg.font = `700 ${Math.round(retroCanvas.width * 0.09)}px "IBM Plex Sans", system-ui, sans-serif`; rg.fillText(chi.nome.toUpperCase().slice(0, 12), cx, cy - retroCanvas.width * 0.16) }
    if (chi.numero) { rg.font = `700 ${Math.round(retroCanvas.width * 0.32)}px "IBM Plex Mono", ui-monospace, monospace`; rg.fillText(chi.numero, cx, cy + retroCanvas.width * 0.05) }
    const retroTex = new THREE.CanvasTexture(retroCanvas)
    retroTex.colorSpace = THREE.SRGBColorSpace
    const retro = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({ map: retroTex, transparent: true, alphaTest: 0.08, roughness: 0.7 }),
    )
    retro.rotation.y = Math.PI
    retro.position.set(0, H / 2, -0.004)
    perno.add(retro)

    // Esultanza a pose chiave sul cartonato: rincorsa, salto, atterraggio, giro, balletto.
    type P = { y?: number; ry?: number; rz?: number; sx?: number; sy?: number; rx?: number }
    const tr: [number, P][] = [
      [0.0, {}],
      [0.28, { sy: 0.9, sx: 1.07, rx: 0.06 }],
      [0.6, { y: 0.5, sy: 1.08, sx: 0.95, rz: 0.1, rx: -0.08 }],
      [0.9, { y: 0.0, sy: 0.86, sx: 1.1 }],
      [1.1, {}],
      [1.35, { y: 0.18, ry: Math.PI, sy: 1.04, sx: 0.97 }],
      [1.65, { y: 0.0, ry: Math.PI * 2, sy: 0.93, sx: 1.05 }],
      [1.85, { ry: Math.PI * 2 }],
      [2.1, { ry: Math.PI * 2, rz: 0.13, y: 0.06 }],
      [2.35, { ry: Math.PI * 2, rz: -0.13 }],
      [2.6, { ry: Math.PI * 2, rz: 0.1, y: 0.06 }],
      [2.85, { ry: Math.PI * 2, rz: -0.06 }],
      [3.3, { ry: Math.PI * 2 }],
    ]
    const durata = tr[tr.length - 1][0]
    const ritmo: Record<Esultanza, number> = { aeroplano: 0.9, pugno: 1, scivolata: 1.12 }
    return (t: number) => {
      const tt = ((t * ritmo[esultanza]) % durata + durata) % durata
      let i = 0
      while (i < tr.length - 2 && tr[i + 1][0] <= tt) i++
      const [t0, a] = tr[i], [t1, b] = tr[i + 1]
      const u = dolce(Math.min(1, Math.max(0, (tt - t0) / (t1 - t0 || 1))))
      const v = (k: keyof P, d: number) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * u
      perno.position.y = v('y', 0)
      perno.rotation.set(v('rx', 0), v('ry', 0) + Math.sin(t * 1.3) * 0.12, v('rz', 0))
      perno.scale.set(v('sx', 1), v('sy', 1), 1)
    }
  }

  function statuinaArgilla(): (t: number) => void {
    // ---- Lo scheletro
    const radice = new THREE.Group()
    tutto.add(radice)
    const bacino = new THREE.Group()
    bacino.position.y = 0.98
    radice.add(bacino)

    const vita = pezzo(new THREE.CylinderGeometry(0.19, 0.215, 0.2, 28), mCalzoncini)
    vita.scale.set(1, 1, 0.74)
    vita.position.y = -0.02
    bacino.add(vita)

    const busto = new THREE.Group()
    busto.position.y = 0.06
    bacino.add(busto)
    // Busto a V: stretto in vita, largo alle spalle. Le strisce seguono la circonferenza.
    const profilo = [
      [0.0, 0.0], [0.175, 0.0], [0.185, 0.06], [0.19, 0.16], [0.215, 0.28], [0.25, 0.4], [0.262, 0.47], [0.24, 0.53], [0.16, 0.58], [0.085, 0.6], [0.0, 0.6],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const torace = pezzo(new THREE.LatheGeometry(profilo, 40), mMaglia)
    torace.scale.set(1, 1, 0.66)
    busto.add(torace)
    const colletto = pezzo(new THREE.TorusGeometry(0.085, 0.022, 10, 28), mSecondo)
    colletto.rotation.x = Math.PI / 2
    colletto.position.y = 0.6
    colletto.scale.set(1, 0.8, 1)
    busto.add(colletto)

    if (chi.nome || chi.numero) {
      const schiena = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.34),
        new THREE.MeshStandardMaterial({ map: scritta(THREE, chi, kit.numero), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
      )
      schiena.position.set(0, 0.33, -0.158)
      schiena.rotation.y = Math.PI
      busto.add(schiena)
    }

    const collo = pezzo(new THREE.CylinderGeometry(0.062, 0.075, 0.12, 20), mPelle)
    collo.position.y = 0.64
    busto.add(collo)
    const testa = new THREE.Group()
    testa.position.y = 0.72
    busto.add(testa)
    const cranio = pezzo(new THREE.SphereGeometry(0.135, 40, 30), mPelle)
    cranio.position.y = 0.1
    cranio.scale.set(0.9, 1.08, 1.0)
    testa.add(cranio)
    const mento = pezzo(new THREE.SphereGeometry(0.08, 24, 16), mPelle)
    mento.position.set(0, 0.035, 0.035)
    mento.scale.set(1, 0.9, 1)
    testa.add(mento)
    for (const lato of [-1, 1]) {
      const orecchio = pezzo(new THREE.SphereGeometry(0.028, 12, 10), mPelle)
      orecchio.position.set(0.118 * lato, 0.09, -0.005)
      orecchio.scale.set(0.5, 1, 0.8)
      testa.add(orecchio)
    }
    const capelli = pezzo(new THREE.SphereGeometry(0.142, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.46), mCapelli)
    capelli.position.y = 0.112
    capelli.rotation.x = -0.32
    capelli.scale.set(0.93, 1.05, 1.04)
    testa.add(capelli)

    const braccio = (lato: 1 | -1) => {
      const spalla = new THREE.Group()
      spalla.position.set(0.262 * lato, 0.48, 0)
      busto.add(spalla)
      const deltoide = pezzo(new THREE.SphereGeometry(0.078, 20, 14), mManica)
      spalla.add(deltoide)
      const manica = pezzo(new THREE.CylinderGeometry(0.078, 0.07, 0.15, 20), mManica)
      manica.position.y = -0.08
      spalla.add(manica)
      const orlo = pezzo(new THREE.TorusGeometry(0.069, 0.01, 8, 24), mSecondo)
      orlo.rotation.x = Math.PI / 2
      orlo.position.y = -0.155
      spalla.add(orlo)
      const omero = segmento(0.052, 0.2, mPelle, 0.046)
      omero.position.y = -0.07
      spalla.add(omero)
      const gomito = new THREE.Group()
      gomito.position.y = -0.29
      spalla.add(gomito)
      gomito.add(segmento(0.044, 0.2, mPelle, 0.036))
      const mano = pezzo(new THREE.SphereGeometry(0.05, 16, 12), mPelle)
      mano.position.y = -0.25
      mano.scale.set(0.85, 1.15, 0.7)
      gomito.add(mano)
      return { spalla, gomito }
    }
    const gamba = (lato: 1 | -1) => {
      const anca = new THREE.Group()
      anca.position.set(0.1 * lato, -0.05, 0)
      bacino.add(anca)
      const pantaloncino = pezzo(new THREE.CylinderGeometry(0.1, 0.097, 0.17, 20), mCalzoncini)
      pantaloncino.position.y = -0.06
      anca.add(pantaloncino)
      const coscia = segmento(0.078, 0.3, mPelle, 0.06)
      coscia.position.y = -0.05
      anca.add(coscia)
      const ginocchio = new THREE.Group()
      ginocchio.position.y = -0.4
      anca.add(ginocchio)
      ginocchio.add(segmento(0.064, 0.3, mCalze, 0.042))
      const fascia = pezzo(new THREE.TorusGeometry(0.066, 0.012, 8, 24), mSecondo)
      fascia.rotation.x = Math.PI / 2
      fascia.position.y = -0.05
      ginocchio.add(fascia)
      const caviglia = new THREE.Group()
      caviglia.position.y = -0.34
      ginocchio.add(caviglia)
      const scarpa = pezzo(new THREE.CapsuleGeometry(0.048, 0.13, 8, 16), mScarpe)
      scarpa.rotation.x = Math.PI / 2
      scarpa.position.set(0, -0.045, 0.05)
      scarpa.scale.set(1.05, 1, 0.75)
      caviglia.add(scarpa)
      return { anca, ginocchio, caviglia }
    }
    const bs = braccio(-1), bd = braccio(1)
    const gs = gamba(-1), gd = gamba(1)

    const applica = (p: Posa) => {
      const v = (k: Chiave) => p[k] ?? 0
      radice.position.set(v('x'), v('y'), v('z'))
      radice.rotation.set(0, v('ry'), 0)
      bacino.position.y = 0.98 - v('pel')
      busto.rotation.set(v('spX'), v('spY'), v('spZ'))
      testa.rotation.set(v('hdX'), v('hdY'), v('hdZ'))
      bs.spalla.rotation.set(v('sLx'), v('sLy'), v('sLz'))
      bd.spalla.rotation.set(v('sRx'), v('sRy'), v('sRz'))
      bs.gomito.rotation.set(v('eL'), 0, 0)
      bd.gomito.rotation.set(v('eR'), 0, 0)
      gs.anca.rotation.set(v('hLx'), 0, v('hLz'))
      gd.anca.rotation.set(v('hRx'), 0, v('hRz'))
      gs.ginocchio.rotation.set(v('kL'), 0, 0)
      gd.ginocchio.rotation.set(v('kR'), 0, 0)
      gs.caviglia.rotation.set(v('aL'), 0, 0)
      gd.caviglia.rotation.set(v('aR'), 0, 0)
    }


    return (t: number) => applica(posaPer(esultanza, t))
  }

  // ---- Coriandoli nei colori della squadra e dell'arancio del sito.
  const ferma = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const N = ferma ? 0 : 320
  const coriandoli = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.05, 0.028),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }),
    Math.max(N, 1),
  )
  coriandoli.count = N
  const colori = [kit.maglia, kit.secondo, ARANCIO, '#ffffff', '#ffd166', '#16a34a'].map(c => new THREE.Color(c))
  // Metà esplodono dal piedistallo all'inizio (fontana), metà scendono dall'alto per tutto il tempo.
  const stati = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? {
    p: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3),
    v: new THREE.Vector3((Math.random() - 0.5) * 2.6, 2.6 + Math.random() * 2.4, (Math.random() - 0.5) * 2.0),
    r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    w: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5),
    c: colori[i % colori.length],
  } : {
    p: new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.6 + Math.random() * 1.8, (Math.random() - 0.5) * 1.6),
    v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -(0.35 + Math.random() * 0.4), (Math.random() - 0.5) * 0.3),
    r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    w: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3),
    c: colori[i % colori.length],
  }))
  stati.forEach((s, i) => coriandoli.setColorAt(i, s.c))
  scene.add(coriandoli)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), uno = new THREE.Vector3(1, 1, 1)
  const muoviCoriandoli = (dt: number, t: number) => {
    for (let i = 0; i < N; i++) {
      const s = stati[i]
      // Gravità e aria: i coriandoli della fontana rallentano e poi planano.
      if (s.v.y > -0.45) s.v.y -= 3.2 * dt
      s.v.x *= 0.985; s.v.z *= 0.985
      s.p.addScaledVector(s.v, dt)
      s.p.x += Math.sin(t * 2 + i) * 0.003
      s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt
      if (s.p.y < 0) { s.p.y = 2.6 + Math.random() * 0.8; s.p.x = (Math.random() - 0.5) * 2.4 }
      q.setFromEuler(s.r)
      m4.compose(s.p, q, uno)
      coriandoli.setMatrixAt(i, m4)
    }
    coriandoli.instanceMatrix.needsUpdate = true
  }

  // ---- Girarla col dito
  let giro = 0.25, velocita = 0, trascina = false, ultimoX = 0
  const giu = (e: PointerEvent) => { trascina = true; ultimoX = e.clientX; renderer.domElement.setPointerCapture(e.pointerId) }
  const muovi = (e: PointerEvent) => { if (!trascina) return; const dx = e.clientX - ultimoX; ultimoX = e.clientX; giro += dx * 0.012; velocita = dx * 0.012 }
  const su = () => { trascina = false }
  renderer.domElement.addEventListener('pointerdown', giu)
  renderer.domElement.addEventListener('pointermove', muovi)
  renderer.domElement.addEventListener('pointerup', su)
  renderer.domElement.addEventListener('pointercancel', su)

  // Posa ferma per chi ha chiesto meno movimento: il momento più bello di ogni esultanza.
  const POSA_FERMA: Record<Esultanza, number> = { aeroplano: 0.4, pugno: 0.62, scivolata: 2.4 }
  const inizio = performance.now()
  let prima = inizio
  let raf = 0
  const disegna = () => {
    const ora = performance.now()
    const t = ferma ? POSA_FERMA[esultanza] : (ora - inizio) / 1000
    const dt = Math.min(0.05, (ora - prima) / 1000)
    prima = ora
    anima(t)
    festa(t)
    if (N) muoviCoriandoli(dt, t)
    if (!trascina) { giro += velocita; velocita *= 0.94 }
    tutto.rotation.y = giro
    renderer.render(scene, camera)
    if (!ferma) raf = requestAnimationFrame(disegna)
  }
  disegna()

  const ridimensiona = () => {
    const nw = el.clientWidth, nh = el.clientHeight
    if (!nw || !nh) return
    renderer.setSize(nw, nh)
    camera.aspect = nw / nh
    camera.updateProjectionMatrix()
    if (ferma) renderer.render(scene, camera)
  }
  const ro = new ResizeObserver(ridimensiona)
  ro.observe(el)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    renderer.domElement.removeEventListener('pointerdown', giu)
    renderer.domElement.removeEventListener('pointermove', muovi)
    renderer.domElement.removeEventListener('pointerup', su)
    renderer.domElement.removeEventListener('pointercancel', su)
    scene.traverse(o => {
      const m = o as THREE_NS.Mesh
      if (m.geometry) m.geometry.dispose()
      const mm = m.material as THREE_NS.MeshStandardMaterial | undefined
      if (mm) { mm.map?.dispose(); mm.dispose() }
    })
    ambiente.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}

// Trama della maglia: tinta unita, strisce verticali o metà e metà.
function trama(THREE: T, kit: Maglia): THREE_NS.Texture {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = kit.maglia
  g.fillRect(0, 0, 512, 256)
  if (kit.motivo === 'strisce') {
    g.fillStyle = kit.secondo
    for (let x = 0; x < 512; x += 64) g.fillRect(x + 32, 0, 32, 256)
  } else if (kit.motivo === 'meta') {
    g.fillStyle = kit.secondo
    g.fillRect(0, 0, 128, 256)
    g.fillRect(384, 0, 128, 256)
  }
  // Trama del tessuto: righine finissime, si vedono solo da vicino.
  g.globalAlpha = 0.05
  g.fillStyle = '#000'
  for (let y = 0; y < 256; y += 3) g.fillRect(0, y, 512, 1)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Nome e numero da stampare sulla schiena.
function scritta(THREE: T, chi: { nome: string; numero: string }, colore: string): THREE_NS.Texture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = colore
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  if (chi.nome) {
    const nome = chi.nome.toUpperCase().slice(0, 12)
    g.font = `700 ${nome.length > 8 ? 30 : 38}px "IBM Plex Sans", system-ui, sans-serif`
    g.fillText(nome, 128, 48)
  }
  if (chi.numero) {
    g.font = '700 150px "IBM Plex Mono", ui-monospace, monospace'
    g.fillText(chi.numero, 128, chi.nome ? 158 : 128)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
