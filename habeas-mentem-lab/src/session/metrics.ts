// Metriche per clausola: i primi due "occhi del diritto", tempo e corpo.
//
// La mappa della frizione (verde/giallo/rosso) arriverà con i sensori di
// verifica e prova operativa. Qui produciamo soltanto le grandezze grezze,
// separate per sensore, senza fonderle in un giudizio.

import { summarize, type EffortStats } from "../mendi/signal";
import { lxScore, type LxScore } from "./lx";
import type { Clause, Session } from "./model";

export interface ClauseMetrics {
  clauseId: string;
  index: number;
  heading: string | null;
  wordCount: number;
  /** Tempo totale trascorso sulla clausola (ms), sommando le visite. */
  dwellMs: number;
  /** Numero di volte in cui la clausola è stata aperta. */
  visits: number;
  /** Ritorni indietro verso questa clausola. */
  returns: number;
  /** Parole al minuto: sotto ~100 wpm la lettura è probabilmente attenta, sopra ~400 probabilmente saltata. */
  wordsPerMinute: number | null;
  /** Tempo minimo plausibile per leggere tutte le parole a 250 wpm (ms). */
  plausibleReadMs: number;
  /** true se il tempo è così breve da escludere la lettura completa. */
  tooFastToRead: boolean;
  effort: EffortStats;
  /** Terzo indizio, il testo stesso: stima euristica dell'LX Complexity Score. */
  lx: LxScore;
}

export function clauseMetrics(session: Session, clauses: Clause[]): ClauseMetrics[] {
  const dwell = new Map<string, number>();
  const visits = new Map<string, number>();
  const returns = new Map<string, number>();
  let open: { clauseId: string; since: number } | null = null;

  const close = (at: number) => {
    if (!open) return;
    dwell.set(open.clauseId, (dwell.get(open.clauseId) ?? 0) + (at - open.since));
    open = null;
  };

  for (const ev of session.events) {
    if (ev.type === "clause_enter") {
      close(ev.timestamp);
      open = { clauseId: ev.clauseId, since: ev.timestamp };
      visits.set(ev.clauseId, (visits.get(ev.clauseId) ?? 0) + 1);
      if (ev.direction === "back") returns.set(ev.clauseId, (returns.get(ev.clauseId) ?? 0) + 1);
    } else if (ev.type === "clause_leave" || ev.type === "reading_end") {
      close(ev.timestamp);
    }
  }
  // Sessione interrotta senza reading_end: chiudiamo all'ultimo frame noto.
  if (open) {
    const last = session.frames.at(-1)?.frame.timestamp ?? Date.now();
    close(last);
  }

  const byClause = new Map<string, ReturnType<typeof summarize>>();
  for (const c of clauses) {
    const samples = session.frames
      .filter((f) => f.clauseId === c.id && f.effort)
      .map((f) => f.effort!);
    byClause.set(c.id, summarize(samples));
  }

  return clauses.map((c) => {
    const ms = dwell.get(c.id) ?? 0;
    const plausibleReadMs = (c.wordCount / 250) * 60_000;
    return {
      clauseId: c.id,
      index: c.index,
      heading: c.heading,
      wordCount: c.wordCount,
      dwellMs: ms,
      visits: visits.get(c.id) ?? 0,
      returns: returns.get(c.id) ?? 0,
      wordsPerMinute: ms > 0 ? (c.wordCount / ms) * 60_000 : null,
      plausibleReadMs,
      // A più di 600 wpm nessuna presunzione di lettura sopravvive all'aritmetica.
      tooFastToRead: ms > 0 && (c.wordCount / ms) * 60_000 > 600,
      effort: byClause.get(c.id)!,
      lx: lxScore(c.text),
    };
  });
}
