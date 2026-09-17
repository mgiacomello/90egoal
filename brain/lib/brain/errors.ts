/** Errore con un codice HTTP già dentro: le route lo rimandano così com'è. */
export class BrainError extends Error {
  readonly status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'BrainError'
    this.status = status
  }
}

/** Un errore qualsiasi ridotto a { message, status } senza perdere il caso noto. */
export function toBrainError(err: unknown, fallback = 'Errore inatteso.'): BrainError {
  if (err instanceof BrainError) return err
  if (err instanceof Error) return new BrainError(err.message || fallback, 500)
  return new BrainError(fallback, 500)
}
