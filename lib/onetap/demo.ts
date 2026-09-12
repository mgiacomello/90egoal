// ONE TAP — modalità demo.
//
// Ogni scenario è finto solo nella grafica: il testo passa dallo stesso motore
// che analizza le foto vere. Quello che si vede nella demo è quello che succede.

export type DemoChrome = 'chat' | 'photo' | 'note' | 'sms' | 'card' | 'receipt'

export interface DemoScenario {
  id: string
  /** Cosa l'utente crede di aver fotografato. */
  caption: string
  chrome: DemoChrome
  /** Intestazione della finta schermata. */
  from?: string
  lines: string[]
  /** Azione attesa: serve a raccontare la demo, non a deciderla. */
  expect: string
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'phone',
    caption: 'A phone number in a message',
    chrome: 'chat',
    from: 'Luca',
    lines: ['Ciao! Call me when you can:', '+39 333 1234567'],
    expect: 'CALL',
  },
  {
    id: 'address',
    caption: 'An address on a poster',
    chrome: 'photo',
    from: 'Trattoria Bianca',
    lines: ['Trattoria Bianca', 'Via Dante 15, Milano'],
    expect: 'NAVIGATE',
  },
  {
    id: 'iban',
    caption: 'An IBAN on an invoice',
    chrome: 'receipt',
    from: 'Fattura 2026/114',
    lines: ['Studio Legale Rossi', 'IBAN IT60X0542811101000000123456', 'Totale € 1.220,00'],
    expect: 'COPY',
  },
  {
    id: 'email',
    caption: 'An email address on a business card',
    chrome: 'card',
    from: 'Business card',
    lines: ['Giulia Neri — Head of Design', 'hello@example.com', '+39 02 8901234'],
    expect: 'EMAIL',
  },
  {
    id: 'event',
    caption: 'A dinner invitation',
    chrome: 'note',
    from: 'Note',
    lines: ['Dinner at Nobu', 'Tuesday at 19:30'],
    expect: 'ADD TO CALENDAR',
  },
  {
    id: 'reply',
    caption: 'A message that needs an answer',
    chrome: 'chat',
    from: 'Anna',
    lines: ['Hey Marco, can we move the meeting to Thursday afternoon?'],
    expect: 'REPLY',
  },
  {
    id: 'otp',
    caption: 'A verification code',
    chrome: 'sms',
    from: '+39 340 000',
    lines: ['Your verification code is 384920. Do not share it.'],
    expect: 'COPY',
  },
  {
    id: 'link',
    caption: 'A link on a flyer',
    chrome: 'photo',
    from: 'Flyer',
    lines: ['Design Week 2026', 'www.designweek.example.com'],
    expect: 'OPEN',
  },
]

export function demoText(scenario: DemoScenario): string {
  return scenario.lines.join('\n')
}

/** Lo scenario del "momento magico": indirizzo + ora nella stessa riga. */
export const MAGIC_MOMENT = {
  from: 'Anna',
  lines: ['Meet me at Via Dante 15 at 18:30'],
  text: 'Meet me at Via Dante 15 at 18:30',
} as const
