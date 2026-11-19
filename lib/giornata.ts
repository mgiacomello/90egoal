// Più schedine aperte insieme (una per serie) e giornate che durano più giorni.
// Funzioni pure, senza dipendenze oltre agli orari: testate in scripts/game.test.ts.
import { romeToUtcIso } from './time.ts'

interface PartitaMin { date: string; ora?: string | null }
interface SchedinaMin { id: number; deadline: string; partite: PartitaMin[] }

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const oraValida = (o?: string | null): o is string => !!o && /^\d{1,2}:\d{2}$/.test(o)

// La giornata si gioca in più giorni? (Serie A: sabato, domenica, lunedì)
export function suPiuGiorni(partite: PartitaMin[]): boolean {
  return new Set(partite.map(p => p.date).filter(Boolean)).size > 1
}

// Etichetta dell'orario di una partita: "15:00" se la giornata sta in un giorno solo,
// "sab 15:00" se ne prende più d'uno, così non si confonde il sabato con il lunedì.
export function quandoPartita(p: PartitaMin, partite: PartitaMin[]): string {
  if (!suPiuGiorni(partite) || !p.date) return p.ora ?? ''
  const [y, m, d] = p.date.split('-').map(Number)
  const giorno = GIORNI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return p.ora ? `${giorno} ${p.ora}` : giorno
}

// Quando è ragionevole pensare che l'ultima partita sia finita: ultimo calcio d'inizio
// più due ore e mezza. Senza orari, la fine dell'ultimo giorno in calendario.
export function fineStimataIso(s: SchedinaMin): string {
  const fine = s.partite
    .filter(p => p.date)
    .map(p => oraValida(p.ora)
      ? new Date(new Date(romeToUtcIso(p.date, p.ora)).getTime() + 150 * 60000).toISOString()
      : romeToUtcIso(p.date, '23:59'))
    .sort()
  const ultima = fine[fine.length - 1]
  return ultima && ultima > s.deadline ? ultima : new Date(new Date(s.deadline).getTime() + 150 * 60000).toISOString()
}

// Una schedina chiusa e senza risultati completi è "in corso" solo per un giorno dopo
// la fine prevista: poi è una giornata vecchia rimasta aperta, e non deve più tenere
// occupata la pagina di oggi.
const TOLLERANZA_MS = 24 * 3600 * 1000
export function inCorso(s: SchedinaMin, nowIso: string, conclusa: boolean): boolean {
  if (s.deadline > nowIso || conclusa) return false
  return new Date(nowIso).getTime() < new Date(fineStimataIso(s)).getTime() + TOLLERANZA_MS
}

// Cosa mostrare oggi: la schedina principale (in corso, altrimenti la prossima aperta,
// altrimenti l'ultima chiusa) e le altre che meritano attenzione adesso: quelle in corso
// e quelle aperte che chiudono entro `giorni` giorni.
export function delMomento<T extends SchedinaMin>(attive: T[], nowIso: string, conclusa: (s: T) => boolean, giorni = 8): { principale: T | undefined; altre: T[] } {
  const ord = [...attive].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id)
  const vive = ord.filter(s => inCorso(s, nowIso, conclusa(s)))
  const aperte = ord.filter(s => s.deadline > nowIso)
  const passate = ord.filter(s => s.deadline <= nowIso)
  const principale = vive[0] ?? aperte[0] ?? passate[passate.length - 1]
  const limite = new Date(new Date(nowIso).getTime() + giorni * 24 * 3600 * 1000).toISOString()
  const altre = [...vive, ...aperte.filter(s => s.deadline <= limite)].filter(s => s.id !== principale?.id)
  return { principale, altre }
}
