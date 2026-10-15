import type { Schedina } from '@/lib/types'

// La schedina di prova: si gioca senza account, resta sul telefono.
// È la giornata del 17 ottobre dal documento di Max; se il database risponde,
// /prova usa la prossima schedina vera e questa serve solo da riserva.
export const SCHEDINA_PROVA: Schedina = {
  id: 0,
  nome: 'Giornata del 17 ottobre',
  torneo: 'Campionati italiani 2026/27',
  fase: 'campionato',
  attiva: true,
  deadline: '2026-10-17T12:30:00.000Z',
  created_at: '2026-10-01T00:00:00.000Z',
  partite: [
    { home: 'Reggiana', away: 'Torres', date: '2026-10-17', ora: '14:30', competizione: 'Serie C' },
    { home: 'Vado', away: 'Sanbenedettese', date: '2026-10-17', ora: '14:30', competizione: 'Serie C' },
    { home: 'Pianese', away: 'Pineto', date: '2026-10-17', ora: '14:30', competizione: 'Serie C' },
    { home: 'Guidonia', away: 'Forlì', date: '2026-10-17', ora: '14:30', competizione: 'Serie C' },
    { home: 'Carpi', away: 'Lumezzane', date: '2026-10-17', ora: '14:30', competizione: 'Serie C' },
    { home: 'Ascoli', away: 'Empoli', date: '2026-10-17', ora: '15:00', competizione: 'Serie B' },
    { home: 'Carrarese', away: 'Modena', date: '2026-10-17', ora: '15:00', competizione: 'Serie B' },
    { home: 'Benevento', away: 'LR Vicenza', date: '2026-10-17', ora: '15:00', competizione: 'Serie B' },
    { home: 'Padova', away: 'Entella', date: '2026-10-17', ora: '15:00', competizione: 'Serie B' },
    { home: 'Venezia', away: 'Napoli', date: '2026-10-17', ora: '15:00', competizione: 'Serie A' },
  ],
}

export const PROVA_KEY = '90egoal:prova'

export interface PronosticoProva {
  schedina_id: number
  nome: string
  minuti: number[]
  recupero: 'primo' | 'secondo' | null
  first_goal: string | null
  last_goal: string | null
  salvato_il: string
}
