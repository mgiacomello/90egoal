// Il gioco in due lingue: italiano (predefinito) e inglese. La scelta sta in un cookie.
// I testi restano accanto al codice che li mostra, in coppia: tx('Classifica', 'Standings').
// Funzioni pure, senza dipendenze: testate in scripts/game.test.ts.

export type Lingua = 'it' | 'en'
export const COOKIE_LINGUA = 'lingua'

export function linguaDa(valore: string | null | undefined): Lingua {
  return valore === 'en' ? 'en' : 'it'
}

export type Tx = (it: string, en: string) => string
export function txDi(lingua: Lingua): Tx {
  return (it, en) => (lingua === 'en' ? en : it)
}

// Formato di date e orari: le partite restano sempre nell'ora di Roma, cambia solo la lingua.
export function localeDi(lingua: Lingua): string {
  return lingua === 'en' ? 'en-GB' : 'it-IT'
}

const MESI: Record<string, string> = {
  gennaio: 'January', febbraio: 'February', marzo: 'March', aprile: 'April', maggio: 'May', giugno: 'June',
  luglio: 'July', agosto: 'August', settembre: 'September', ottobre: 'October', novembre: 'November', dicembre: 'December',
}

// I nomi delle giornate sono scritti in italiano nel database: qui la versione inglese.
// "Serie A · 12ª giornata" → "Serie A · Matchday 12"; "Giornata del 1° novembre" → "Matchday of 1 November".
// Un nome che non segue questi schemi resta com'è.
export function nomeSchedina(nome: string, lingua: Lingua): string {
  if (lingua !== 'en') return nome
  const serie = /^(.*?)(\d+)ª\s+giornata(.*)$/i.exec(nome)
  if (serie) return `${serie[1]}Matchday ${serie[2]}${serie[3]}`
  const data = /^Giornata del(?:l['’])?\s*(\d+)°?\s+([a-zà]+)(.*)$/i.exec(nome)
  if (data && MESI[data[2].toLowerCase()]) return `Matchday of ${data[1]} ${MESI[data[2].toLowerCase()]}${data[3]}`
  return nome
    .replace(/^Schedina (\d+)/, 'Ticket $1')
    .replace(/^Sedicesimi/, 'Round of 32')
    .replace(/^Fase finale/, 'Final stage')
    .replace('Mondiali FIFA', 'FIFA World Cup')
}

export function nomeTorneo(nome: string, lingua: Lingua): string {
  if (lingua !== 'en') return nome
  return nome.replace(/^Campionati italiani/, 'Italian leagues').replace(/^Mondiali/, 'World Cup')
}

// Giorno della settimana abbreviato, dall'indice di Date.getUTCDay().
const GIORNI: Record<Lingua, string[]> = {
  it: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}
export function giornoBreve(indice: number, lingua: Lingua): string {
  return GIORNI[lingua][indice] ?? ''
}

// Ordinale inglese: 1st, 2nd, 3rd, 4th, 11th, 21st.
export function ordinale(n: number): string {
  const d = n % 100
  if (d >= 11 && d <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
