// Catalogo del Salone di Bellezza: pelli, capelli, trucco, vestiti, accessori.
// Tutto statico: il gioco funziona interamente nel browser, senza server.

export type Fantasia = 'tinta' | 'pois' | 'righe' | 'cuori' | 'stelle'
export type VestitoKind = 'maglietta' | 'felpa' | 'abito' | 'tuta' | 'giacca' | 'maglione'
export type CapelliBack = 'nessuno' | 'lunghi' | 'caschetto' | 'coda' | 'trecce' | 'ricci' | 'chignon' | 'afro'
export type CapelliCap = 'frangia' | 'ciuffo' | 'riga' | 'indietro'
export type Occhiali = 'nessuno' | 'vista' | 'sole'
export type StrumentoTrucco = 'rossetto' | 'ombretto' | 'fard' | 'glitter'

// Una passata di trucco fatta col dito: i punti sono in coordinate del disegno,
// salvati piatti (x,y,x,y...) per non gonfiare il book nel localStorage.
export type Traccia = {
  id: number
  tipo: StrumentoTrucco
  colore: string
  spessore: number
  punti: number[]
}
export type Testa = 'niente' | 'corona' | 'cerchietto' | 'cappello' | 'fiore'

export type Look = {
  nome: string
  pelle: string
  occhi: string
  capelli: string
  capelliColore: string
  coloreNaturale: string
  lunghezza: number
  bagnatura: number
  balsamo: boolean
  volume: number
  rossetto: string | null
  ombretto: string | null
  fard: string | null
  ciglia: boolean
  lentiggini: boolean
  glitter: boolean
  vestito: VestitoKind
  vestitoColore: string
  fantasia: Fantasia
  occhiali: Occhiali
  testa: Testa
  orecchini: boolean
  collana: boolean
  sfondo: string
  pennellate: Traccia[]
  lucidi: boolean
  foto: string | null
  fotoZoom: number
  fotoX: number
  fotoY: number
  fotoRot: number
}

export type Opzione = { id: string; label: string; colore: string; fantasia?: boolean }

export const PELLI: { id: string; label: string; base: string; ombra: string }[] = [
  { id: 'chiara', label: 'Chiara', base: '#ffdfc9', ombra: '#f2c1a5' },
  { id: 'rosata', label: 'Rosata', base: '#fbcdb4', ombra: '#e8ab8d' },
  { id: 'dorata', label: 'Dorata', base: '#eeb98c', ombra: '#d79a68' },
  { id: 'olivastra', label: 'Olivastra', base: '#d59a6a', ombra: '#b87c50' },
  { id: 'ambra', label: 'Ambra', base: '#b8784b', ombra: '#965c35' },
  { id: 'castana', label: 'Castana', base: '#8d5524', ombra: '#6f4019' },
  { id: 'ebano', label: 'Ebano', base: '#5f3a1e', ombra: '#472a14' },
]

export const COLORI_OCCHI: Opzione[] = [
  { id: 'marrone', label: 'Marrone', colore: '#6b4423' },
  { id: 'nocciola', label: 'Nocciola', colore: '#a9743a' },
  { id: 'verde', label: 'Verde', colore: '#3f8f5a' },
  { id: 'azzurro', label: 'Azzurro', colore: '#4aa3d8' },
  { id: 'grigio', label: 'Grigio', colore: '#8b98a5' },
  { id: 'viola', label: 'Viola', colore: '#8b5cf6' },
]

export const ACCONCIATURE: {
  id: string
  label: string
  emoji: string
  back: CapelliBack
  cap: CapelliCap
  allungabile: boolean
}[] = [
  { id: 'lunghi', label: 'Lunghi lisci', emoji: '💇‍♀️', back: 'lunghi', cap: 'riga', allungabile: true },
  { id: 'frangia', label: 'Lunghi con frangia', emoji: '✨', back: 'lunghi', cap: 'frangia', allungabile: true },
  { id: 'caschetto', label: 'Caschetto', emoji: '🎀', back: 'caschetto', cap: 'frangia', allungabile: false },
  { id: 'ricci', label: 'Ricci', emoji: '🌀', back: 'ricci', cap: 'ciuffo', allungabile: true },
  { id: 'coda', label: 'Coda alta', emoji: '🐴', back: 'coda', cap: 'indietro', allungabile: true },
  { id: 'trecce', label: 'Treccine', emoji: '🧶', back: 'trecce', cap: 'riga', allungabile: true },
  { id: 'chignon', label: 'Chignon', emoji: '🩰', back: 'chignon', cap: 'indietro', allungabile: false },
  { id: 'afro', label: 'Afro', emoji: '☁️', back: 'afro', cap: 'ciuffo', allungabile: false },
  { id: 'corti', label: 'Cortissimi', emoji: '✂️', back: 'nessuno', cap: 'ciuffo', allungabile: false },
]

export const COLORI_CAPELLI: Opzione[] = [
  { id: 'castano', label: 'Castano', colore: '#5a3620' },
  { id: 'castanochiaro', label: 'Castano chiaro', colore: '#8b5a2b' },
  { id: 'biondo', label: 'Biondo', colore: '#e0b463' },
  { id: 'platino', label: 'Platino', colore: '#efdfb4' },
  { id: 'nero', label: 'Nero', colore: '#221c1c' },
  { id: 'rame', label: 'Rosso rame', colore: '#c1440e' },
  { id: 'rosa', label: 'Rosa', colore: '#ff8fc7', fantasia: true },
  { id: 'lilla', label: 'Lilla', colore: '#b57edc', fantasia: true },
  { id: 'azzurro', label: 'Azzurro', colore: '#5ec8e5', fantasia: true },
  { id: 'menta', label: 'Menta', colore: '#5fd6a5', fantasia: true },
  { id: 'argento', label: 'Argento', colore: '#c6cfd6' },
]

export const ROSSETTI: Opzione[] = [
  { id: 'rosa', label: 'Rosa', colore: '#ef6d94' },
  { id: 'rosso', label: 'Rosso', colore: '#d62b3f' },
  { id: 'corallo', label: 'Corallo', colore: '#ff7a5c' },
  { id: 'prugna', label: 'Prugna', colore: '#8e3b62' },
  { id: 'pesca', label: 'Pesca', colore: '#f2a07b' },
  { id: 'ciliegia', label: 'Ciliegia', colore: '#b21e3a' },
]

export const OMBRETTI: Opzione[] = [
  { id: 'cielo', label: 'Cielo', colore: '#7cc4ef' },
  { id: 'lilla', label: 'Lilla', colore: '#b490e0' },
  { id: 'menta', label: 'Menta', colore: '#7fd6b1' },
  { id: 'oro', label: 'Oro', colore: '#e8c15a' },
  { id: 'rosa', label: 'Rosa', colore: '#f3a0c0' },
  { id: 'fumo', label: 'Fumo di Londra', colore: '#8a8f9c' },
]

export const FARD: Opzione[] = [
  { id: 'rosa', label: 'Rosa', colore: '#ff9db0' },
  { id: 'pesca', label: 'Pesca', colore: '#ffb38a' },
  { id: 'corallo', label: 'Corallo', colore: '#ff8f7a' },
]

export const VESTITI: { id: VestitoKind; label: string; emoji: string }[] = [
  { id: 'maglietta', label: 'Maglietta', emoji: '👕' },
  { id: 'felpa', label: 'Felpa', emoji: '🧥' },
  { id: 'abito', label: 'Abito da sera', emoji: '👗' },
  { id: 'tuta', label: 'Tuta sportiva', emoji: '🏃‍♀️' },
  { id: 'giacca', label: 'Giacca elegante', emoji: '🤵' },
  { id: 'maglione', label: 'Maglione', emoji: '🧶' },
]

export const COLORI_VESTITO: Opzione[] = [
  { id: 'rosa', label: 'Rosa', colore: '#ff7eb6' },
  { id: 'rosso', label: 'Rosso', colore: '#e63946' },
  { id: 'arancio', label: 'Arancio', colore: '#ff9f43' },
  { id: 'giallo', label: 'Giallo', colore: '#ffd24a' },
  { id: 'verde', label: 'Verde', colore: '#37d67a' },
  { id: 'menta', label: 'Menta', colore: '#5fd6c3' },
  { id: 'azzurro', label: 'Azzurro', colore: '#4aa3d8' },
  { id: 'blu', label: 'Blu', colore: '#3f51b5' },
  { id: 'viola', label: 'Viola', colore: '#8b5cf6' },
  { id: 'nero', label: 'Nero', colore: '#2b2f38' },
  { id: 'bianco', label: 'Bianco', colore: '#f4f7fb' },
  { id: 'oro', label: 'Oro', colore: '#e6bd4f' },
]

export const FANTASIE: { id: Fantasia; label: string; emoji: string }[] = [
  { id: 'tinta', label: 'Tinta unita', emoji: '🎨' },
  { id: 'pois', label: 'A pois', emoji: '⚪' },
  { id: 'righe', label: 'A righe', emoji: '📏' },
  { id: 'cuori', label: 'Cuori', emoji: '💗' },
  { id: 'stelle', label: 'Stelle', emoji: '⭐' },
]

export const OCCHIALI: { id: Occhiali; label: string; emoji: string }[] = [
  { id: 'nessuno', label: 'Niente', emoji: '🚫' },
  { id: 'vista', label: 'Da vista', emoji: '👓' },
  { id: 'sole', label: 'Da sole', emoji: '🕶️' },
]

export const TESTA: { id: Testa; label: string; emoji: string }[] = [
  { id: 'niente', label: 'Niente', emoji: '🚫' },
  { id: 'corona', label: 'Corona', emoji: '👑' },
  { id: 'cerchietto', label: 'Cerchietto', emoji: '🎀' },
  { id: 'cappello', label: 'Cappellino', emoji: '🧢' },
  { id: 'fiore', label: 'Fiore', emoji: '🌸' },
]

export const SFONDI: { id: string; label: string; da: string; a: string; stelle: boolean }[] = [
  { id: 'salone', label: 'Salone rosa', da: '#ffd9ec', a: '#ffb4d8', stelle: false },
  { id: 'cielo', label: 'Cielo', da: '#cdefff', a: '#8fd3f4', stelle: false },
  { id: 'tramonto', label: 'Tramonto', da: '#ffd6a5', a: '#ff8fab', stelle: false },
  { id: 'menta', label: 'Menta', da: '#d8f8ec', a: '#8fe3c8', stelle: false },
  { id: 'notte', label: 'Notte magica', da: '#3b2f6b', a: '#8b5cf6', stelle: true },
  { id: 'studio', label: 'Studio', da: '#f4f7fb', a: '#dfe6ee', stelle: false },
]

export const PENNELLI: {
  id: StrumentoTrucco
  label: string
  emoji: string
  spessore: number
  colori: Opzione[]
}[] = [
  { id: 'rossetto', label: 'Rossetto', emoji: '💄', spessore: 11, colori: ROSSETTI },
  { id: 'ombretto', label: 'Ombretto', emoji: '👁️', spessore: 13, colori: OMBRETTI },
  { id: 'fard', label: 'Fard', emoji: '🌸', spessore: 30, colori: FARD },
  {
    id: 'glitter',
    label: 'Glitter',
    emoji: '✨',
    spessore: 9,
    colori: [
      { id: 'oro', label: 'Oro', colore: '#ffd24a' },
      { id: 'argento', label: 'Argento', colore: '#ffffff' },
      { id: 'rosa', label: 'Rosa', colore: '#ff8fc7' },
      { id: 'azzurro', label: 'Azzurro', colore: '#7cc4ef' },
    ],
  },
]

export const OPACITA_PENNELLO: Record<StrumentoTrucco, number> = {
  rossetto: 0.85,
  ombretto: 0.6,
  fard: 0.45,
  glitter: 1,
}

export const LOOK_BASE: Look = {
  nome: 'Olivia',
  pelle: 'chiara',
  occhi: '#6b4423',
  capelli: 'lunghi',
  capelliColore: '#5a3620',
  coloreNaturale: '#5a3620',
  lunghezza: 1,
  bagnatura: 0,
  balsamo: false,
  volume: 0,
  rossetto: null,
  ombretto: null,
  fard: null,
  ciglia: true,
  lentiggini: false,
  glitter: false,
  vestito: 'maglietta',
  vestitoColore: '#ff7eb6',
  fantasia: 'tinta',
  occhiali: 'nessuno',
  testa: 'niente',
  orecchini: false,
  collana: false,
  sfondo: 'salone',
  pennellate: [],
  lucidi: false,
  foto: null,
  fotoZoom: 1,
  fotoX: 0,
  fotoY: 0,
  fotoRot: 0,
}

// Modelle già pronte: si parte da una di queste, oppure da una tua foto.
export const MODELLE: { id: string; look: Look }[] = [
  {
    id: 'olivia',
    look: { ...LOOK_BASE, nome: 'Olivia', pelle: 'chiara', occhi: '#4aa3d8', capelli: 'frangia', capelliColore: '#8b5a2b', coloreNaturale: '#8b5a2b', vestitoColore: '#ff7eb6', fantasia: 'cuori', lentiggini: true },
  },
  {
    id: 'aisha',
    look: { ...LOOK_BASE, nome: 'Aisha', pelle: 'castana', occhi: '#6b4423', capelli: 'trecce', capelliColore: '#221c1c', coloreNaturale: '#221c1c', vestito: 'abito', vestitoColore: '#e6bd4f', sfondo: 'tramonto' },
  },
  {
    id: 'sofia',
    look: { ...LOOK_BASE, nome: 'Sofia', pelle: 'dorata', occhi: '#3f8f5a', capelli: 'ricci', capelliColore: '#c1440e', coloreNaturale: '#c1440e', vestito: 'felpa', vestitoColore: '#5fd6c3', fantasia: 'stelle' },
  },
  {
    id: 'nina',
    look: { ...LOOK_BASE, nome: 'Nina', pelle: 'rosata', occhi: '#8b5cf6', capelli: 'chignon', capelliColore: '#ff8fc7', coloreNaturale: '#8b5a2b', vestito: 'abito', vestitoColore: '#8b5cf6', sfondo: 'notte', glitter: true },
  },
  {
    id: 'malik',
    look: { ...LOOK_BASE, nome: 'Malik', pelle: 'ebano', occhi: '#6b4423', capelli: 'afro', capelliColore: '#221c1c', coloreNaturale: '#221c1c', vestito: 'tuta', vestitoColore: '#37d67a', sfondo: 'menta' },
  },
  {
    id: 'leo',
    look: { ...LOOK_BASE, nome: 'Leo', pelle: 'olivastra', occhi: '#8b98a5', capelli: 'corti', capelliColore: '#221c1c', coloreNaturale: '#221c1c', vestito: 'giacca', vestitoColore: '#3f51b5', occhiali: 'vista', sfondo: 'studio' },
  },
]

// Schiarisce (amount > 0) o scurisce (amount < 0) un colore esadecimale.
export function tono(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full, 16)
  const canale = (shift: number) => {
    const v = (num >> shift) & 0xff
    const next = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount)
    return Math.max(0, Math.min(255, Math.round(next)))
  }
  const to2 = (v: number) => v.toString(16).padStart(2, '0')
  return `#${to2(canale(16))}${to2(canale(8))}${to2(canale(0))}`
}

// Miscela due colori: quota 0 = il primo, 1 = il secondo.
export function mescola(a: string, b: string, quota: number): string {
  const leggi = (hex: string) => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const n = parseInt(full, 16)
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
  }
  const [r1, g1, b1] = leggi(a)
  const [r2, g2, b2] = leggi(b)
  const t = Math.max(0, Math.min(1, quota))
  const to2 = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${to2(r1 + (r2 - r1) * t)}${to2(g1 + (g2 - g1) * t)}${to2(b1 + (b2 - b1) * t)}`
}

export function eFantasia(colore: string): boolean {
  return COLORI_CAPELLI.some((c) => c.colore === colore && c.fantasia)
}

function scegli<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)]
}

// "Sorpresa!": un look casuale, mantenendo nome ed eventuale foto caricata.
// I look salvati nel book prima di queste funzioni non hanno i campi nuovi.
export function completaLook(look: Look): Look {
  return {
    ...look,
    pennellate: Array.isArray(look.pennellate) ? look.pennellate : [],
    lucidi: Boolean(look.lucidi),
    coloreNaturale: look.coloreNaturale ?? '#5a3620',
    bagnatura: typeof look.bagnatura === 'number' ? look.bagnatura : 0,
    balsamo: Boolean(look.balsamo),
    volume: typeof look.volume === 'number' ? look.volume : 0,
  }
}

export function lookCasuale(precedente: Look): Look {
  const forse = <T,>(valore: T, probabilita = 0.6): T | null =>
    Math.random() < probabilita ? valore : null
  return {
    ...precedente,
    pelle: precedente.foto ? precedente.pelle : scegli(PELLI).id,
    occhi: scegli(COLORI_OCCHI).colore,
    capelli: scegli(ACCONCIATURE).id,
    capelliColore: scegli(COLORI_CAPELLI).colore,
    bagnatura: 0,
    volume: 0,
    lunghezza: Math.round((0.35 + Math.random() * 1.15) * 20) / 20,
    rossetto: forse(scegli(ROSSETTI).colore),
    ombretto: forse(scegli(OMBRETTI).colore, 0.5),
    fard: forse(scegli(FARD).colore, 0.5),
    ciglia: Math.random() < 0.7,
    lentiggini: Math.random() < 0.35,
    glitter: Math.random() < 0.4,
    vestito: scegli(VESTITI).id,
    vestitoColore: scegli(COLORI_VESTITO).colore,
    fantasia: scegli(FANTASIE).id,
    occhiali: scegli(OCCHIALI).id,
    testa: scegli(TESTA).id,
    orecchini: Math.random() < 0.5,
    collana: Math.random() < 0.4,
    sfondo: scegli(SFONDI).id,
  }
}
