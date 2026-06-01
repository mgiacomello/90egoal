// Mappa nome nazionale (italiano) → codice ISO per flagcdn.com
const FLAG_CODES: Record<string, string> = {
  'Messico': 'mx',
  'Sudafrica': 'za',
  'Stati Uniti': 'us',
  'Paraguay': 'py',
  'Brasile': 'br',
  'Marocco': 'ma',
  'Germania': 'de',
  'Curaçao': 'cw',
  'Paesi Bassi': 'nl',
  'Giappone': 'jp',
  'Spagna': 'es',
  'Capo Verde': 'cv',
  'Belgio': 'be',
  'Egitto': 'eg',
  'Francia': 'fr',
  'Senegal': 'sn',
  'Iraq': 'iq',
  'Norvegia': 'no',
  'Argentina': 'ar',
  'Algeria': 'dz',
  'Uzbekistan': 'uz',
  'Colombia': 'co',
  'Australia': 'au',
  'Haiti': 'ht',
  "Costa d'Avorio": 'ci',
  'Ecuador': 'ec',
  'Arabia Saudita': 'sa',
  'Uruguay': 'uy',
  'Panama': 'pa',
  'Inghilterra': 'gb-eng',
}

export function flagUrl(team: string, width: 20 | 40 | 80 | 160 = 40): string {
  const code = FLAG_CODES[team] ?? 'un'
  return `https://flagcdn.com/w${width}/${code}.png`
}

export function flagCode(team: string): string {
  return FLAG_CODES[team] ?? 'un'
}
