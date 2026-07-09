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
  fase?: 'gironi' | 'eliminazione'
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
  extra_time?: boolean | null
  submitted_at: string
}

export interface GoalScored {
  min: string        // es. "67'" o "90+2'"
  team: string       // squadra che ha segnato (autogol → squadra che ne beneficia)
}

export interface MatchDetail {
  home: string
  away: string
  score: string          // es. "2-0"
  minuti: string[]       // es. ["9'", "45+5'", "67'"] — retrocompatibilità/display rapido
  gol?: GoalScored[]     // marcatore per gol (per analisi per-squadra); assente sui dati vecchi
}

export interface Risultato {
  id: number
  schedina_id: number
  minuti_gol: number[]
  recupero: 'primo' | 'secondo' | 'entrambi' | 'nessuno'
  first_goal_team: string | null
  last_goal_team: string | null
  extra_time?: boolean | null
  note: string | null
  dettagli?: MatchDetail[]
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
  minuti_azzeccati?: number[]
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

export interface TimingSummary {
  event: string
  campioni: number
  media_sec: number
  mediana_sec: number
  min_sec: number
  max_sec: number
}

export interface SectionTime {
  sezione: string
  minuti_totali: number
  utenti: number
}
