export interface Partita {
  home: string
  away: string
  date: string
  venue: string
}

export interface Schedina {
  id: number
  nome: string
  deadline: string
  partite: Partita[]
  attiva: boolean
  created_at: string
}

export interface Pronostico {
  id: string
  user_id: string
  schedina_id: number
  minuti: number[]
  recupero: 'primo' | 'secondo' | null
  first_goal: string | null
  last_goal: string | null
  submitted_at: string
}

export interface Risultato {
  id: number
  schedina_id: number
  minuti_gol: number[]
  recupero: 'primo' | 'secondo' | 'entrambi' | 'nessuno'
  first_goal_team: string | null
  last_goal_team: string | null
  note: string | null
}

export interface ClassificaRow {
  schedina_id: number
  user_id: string
  username: string
  full_name: string
  punti_minuti: number
  punti_recupero: number
  punti_bonus: number
  totale: number
}

export interface Profile {
  id: string
  username: string
  full_name: string
  is_admin: boolean
  email?: string | null
  created_at?: string
}

export interface ActivitySummary {
  user_id: string
  minuti_attivi: number
  primo_accesso: string
  ultimo_accesso: string
  giorni_attivi: number
}
