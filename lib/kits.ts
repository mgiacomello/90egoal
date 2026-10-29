import { coloreSquadra } from './teams.ts'

// Le maglie dei club delle schedine: colori sociali, non i loghi (quelli sono dei club).
// Servono alla statuina che festeggia il gol. Chi non è in elenco prende il colore
// stabile di coloreSquadra con calzoncini bianchi.

export type Motivo = 'tinta' | 'strisce' | 'meta'

export interface Maglia {
  maglia: string       // colore principale
  secondo: string      // strisce, maniche, bordi
  calzoncini: string
  calzettoni: string
  numero: string       // colore di numero e nome sulla schiena
  motivo: Motivo
}

const BIANCO = '#f4f2ec'
const NERO = '#1b1b1d'
const k = (maglia: string, secondo: string, calzoncini: string, calzettoni: string, numero: string, motivo: Motivo = 'tinta'): Maglia =>
  ({ maglia, secondo, calzoncini, calzettoni, numero, motivo })

const MAGLIE: Record<string, Maglia> = {
  // Serie A
  'Inter': k('#0f3fa8', NERO, NERO, NERO, BIANCO, 'strisce'),
  'Milan': k('#c4161c', NERO, BIANCO, NERO, BIANCO, 'strisce'),
  'Juventus': k(BIANCO, NERO, BIANCO, BIANCO, NERO, 'strisce'),
  'Roma': k('#8e1b2b', '#f2a900', BIANCO, '#8e1b2b', '#f2a900'),
  'Lazio': k('#87c6ef', BIANCO, BIANCO, '#87c6ef', BIANCO),
  'Atalanta': k('#1f4fa8', NERO, NERO, NERO, BIANCO, 'strisce'),
  'Fiorentina': k('#5b2d8e', BIANCO, '#5b2d8e', '#5b2d8e', BIANCO),
  'Udinese': k(BIANCO, NERO, NERO, BIANCO, NERO, 'strisce'),
  'Genoa': k('#c4161c', '#0f3fa8', BIANCO, '#c4161c', BIANCO, 'meta'),
  'Napoli': k('#1c8ad6', BIANCO, BIANCO, '#1c8ad6', BIANCO),
  'Cagliari': k('#9a1b2f', '#123a7a', '#123a7a', '#123a7a', BIANCO, 'meta'),
  'Bologna': k('#9a1b2f', '#123a7a', BIANCO, '#123a7a', BIANCO, 'strisce'),
  'Como': k('#1f3f8f', BIANCO, '#1f3f8f', '#1f3f8f', BIANCO),
  'Sassuolo': k('#0f7a3e', NERO, NERO, '#0f7a3e', BIANCO, 'strisce'),
  'Venezia': k(NERO, '#e8641c', NERO, NERO, '#e8641c'),
  'Torino': k('#7a1f2b', BIANCO, BIANCO, '#7a1f2b', BIANCO),
  'Lecce': k('#e9c21d', '#c4161c', '#c4161c', '#c4161c', '#c4161c', 'strisce'),
  'Parma': k(BIANCO, NERO, BIANCO, BIANCO, NERO),
  'Cremonese': k('#8a8d91', '#c4161c', BIANCO, '#c4161c', BIANCO, 'strisce'),
  'Pisa': k('#1d1d4f', NERO, NERO, NERO, BIANCO, 'strisce'),
  'Verona': k('#163e8f', '#f2c418', '#163e8f', '#163e8f', '#f2c418'),
  'Atalanta U23': k('#1f4fa8', NERO, NERO, NERO, BIANCO, 'strisce'),
  'Frosinone': k('#f2c418', '#1f3f8f', '#1f3f8f', '#f2c418', '#1f3f8f'),
  // Serie B
  'Ascoli': k(BIANCO, NERO, NERO, NERO, NERO, 'strisce'),
  'Empoli': k('#1a5fb4', BIANCO, BIANCO, '#1a5fb4', BIANCO),
  'Carrarese': k('#f2c418', '#1f3f8f', '#1f3f8f', '#f2c418', '#1f3f8f', 'strisce'),
  'Modena': k('#f2c418', '#1f3f8f', '#1f3f8f', '#1f3f8f', '#1f3f8f'),
  'Benevento': k('#c4161c', '#f2c418', '#c4161c', '#c4161c', '#f2c418', 'strisce'),
  'LR Vicenza': k(BIANCO, '#c4161c', BIANCO, '#c4161c', '#c4161c', 'strisce'),
  'Padova': k(BIANCO, '#c4161c', BIANCO, BIANCO, '#c4161c'),
  'Entella': k('#8fc4e8', BIANCO, BIANCO, '#8fc4e8', '#1f3f8f', 'strisce'),
  'Mantova': k(BIANCO, '#c4161c', BIANCO, BIANCO, '#c4161c'),
  'Sudtirol': k('#c4161c', BIANCO, BIANCO, '#c4161c', BIANCO),
  'Sampdoria': k('#1f4fa8', BIANCO, BIANCO, '#1f4fa8', BIANCO),
  'Avellino': k('#0f7a3e', BIANCO, BIANCO, '#0f7a3e', BIANCO),
  'Cesena': k(BIANCO, NERO, NERO, BIANCO, NERO),
  'Juve Stabia': k('#f2c418', '#1f3f8f', '#1f3f8f', '#f2c418', '#1f3f8f', 'strisce'),
  'Arezzo': k('#7a1f2b', BIANCO, '#7a1f2b', '#7a1f2b', BIANCO),
  'Catanzaro': k('#f2c418', '#c4161c', '#c4161c', '#c4161c', '#c4161c', 'meta'),
  // Serie C
  'Reggiana': k('#7a1f2b', BIANCO, BIANCO, '#7a1f2b', BIANCO),
  'Torres': k('#c4161c', '#1f3f8f', '#1f3f8f', '#1f3f8f', BIANCO, 'strisce'),
  'Vado': k('#c4161c', '#1f3f8f', '#1f3f8f', '#1f3f8f', BIANCO, 'strisce'),
  'Sanbenedettese': k('#c4161c', '#1f3f8f', BIANCO, '#c4161c', BIANCO, 'strisce'),
  'Pineto': k(BIANCO, '#1f6fd1', '#1f6fd1', '#1f6fd1', '#1f6fd1'),
  'Forlì': k(BIANCO, '#c4161c', BIANCO, '#c4161c', '#c4161c'),
  'Carpi': k(BIANCO, '#c4161c', BIANCO, '#c4161c', '#c4161c', 'strisce'),
  'Lumezzane': k('#c4161c', '#1f3f8f', '#1f3f8f', '#1f3f8f', BIANCO, 'meta'),
  'Spezia': k(BIANCO, NERO, NERO, BIANCO, NERO),
  'Latina': k('#1f4fa8', NERO, NERO, NERO, BIANCO, 'strisce'),
  'Campobasso': k('#c4161c', '#1f3f8f', '#1f3f8f', '#c4161c', BIANCO, 'meta'),
  'Treviso': k(BIANCO, '#5fa8dc', BIANCO, '#5fa8dc', '#1f3f8f'),
  'Cittadella': k('#7a1f2b', BIANCO, BIANCO, '#7a1f2b', BIANCO),
  'Ravenna': k('#f2c418', '#c4161c', '#c4161c', '#c4161c', '#c4161c', 'strisce'),
  'Salernitana': k('#7a1f2b', BIANCO, BIANCO, '#7a1f2b', BIANCO),
  'Lecco': k('#1f3f8f', '#5fa8dc', '#1f3f8f', '#1f3f8f', BIANCO, 'strisce'),
  'Renate': k('#1f4fa8', NERO, NERO, NERO, BIANCO, 'strisce'),
  'Arzignano': k('#f2c418', '#5fa8dc', '#5fa8dc', '#f2c418', '#1f3f8f', 'meta'),
  'Livorno': k('#7a1f2b', BIANCO, '#7a1f2b', '#7a1f2b', BIANCO),
  'Ostiamare': k(BIANCO, '#6b3fa0', '#6b3fa0', '#6b3fa0', '#6b3fa0'),
  'Union Brescia': k('#1f4fa8', BIANCO, BIANCO, '#1f4fa8', BIANCO),
  'Crotone': k('#1f3f8f', '#c4161c', BIANCO, '#1f3f8f', BIANCO, 'strisce'),
  'Casertana': k('#c4161c', '#1f3f8f', '#1f3f8f', '#c4161c', BIANCO, 'strisce'),
  'Casarano': k(BIANCO, '#1f6fd1', '#1f6fd1', '#1f6fd1', '#1f6fd1', 'strisce'),
}

export function magliaDi(team: string): Maglia {
  const m = MAGLIE[team]
  if (m) return m
  const c = coloreSquadra(team)
  return k(c, BIANCO, BIANCO, c, BIANCO)
}

// "Lautaro 10", "10 Lautaro", "Lautaro" → { nome, numero }. Il numero è facoltativo.
export function parseMarcatore(raw: string): { nome: string; numero: string } {
  const s = raw.trim().replace(/\s+/g, ' ')
  const fine = /^(.*?)\s+(\d{1,2})$/.exec(s)
  if (fine) return { nome: fine[1], numero: fine[2] }
  const inizio = /^(\d{1,2})\s+(.*)$/.exec(s)
  if (inizio) return { nome: inizio[2], numero: inizio[1] }
  return { nome: s, numero: '' }
}
