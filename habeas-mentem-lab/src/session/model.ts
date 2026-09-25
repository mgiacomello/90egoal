// Modello della sessione di lettura.
//
// Una sessione lega un partecipante pseudonimo, un documento diviso in
// clausole, la baseline a riposo e la sequenza di eventi di navigazione.
// Ogni frame Mendi viene annotato con la clausola visibile in quel momento.

import type { Frame } from "../mendi/types";
import type { EffortSample } from "../mendi/signal";

export interface Clause {
  id: string;
  /** Ordine di lettura (1-based). */
  index: number;
  heading: string | null;
  text: string;
  wordCount: number;
}

/** Domanda di comprensione a risposta chiusa, legata a una clausola (sensore "verifica"). */
export interface Question {
  id: string;
  clauseId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

/** Compito pratico: trovare la clausola che serve (sensore "prova operativa"). */
export interface Task {
  id: string;
  /** La clausola giusta da ritrovare. */
  clauseId: string;
  prompt: string;
}

export interface Document {
  id: string;
  title: string;
  /** Provenienza: "modello" (scritto per il lab) o "incollato" (fornito dall'utente). */
  source: "modello" | "incollato";
  clauses: Clause[];
  /** Vuoti per i testi incollati: verifica e prova operativa vengono saltate. */
  questions: Question[];
  tasks: Task[];
}

export interface AnswerRecord {
  questionId: string;
  clauseId: string;
  chosenIndex: number;
  correct: boolean;
  timestamp: number;
  /** Tempo impiegato a rispondere (ms). */
  ms: number;
}

export interface TaskRecord {
  taskId: string;
  clauseId: string;
  chosenClauseId: string;
  correct: boolean;
  timestamp: number;
  ms: number;
  /** Quante clausole ha aperto prima di scegliere. */
  opened: number;
}

export type NavigationEvent =
  | { type: "baseline_start"; timestamp: number }
  | { type: "baseline_end"; timestamp: number }
  | { type: "clause_enter"; timestamp: number; clauseId: string; direction: "forward" | "back" | "start" }
  | { type: "clause_leave"; timestamp: number; clauseId: string }
  | { type: "segment_enter"; timestamp: number; clauseId: string; segmentId: string; direction: "forward" | "back" | "start" | "auto" }
  | { type: "segment_leave"; timestamp: number; segmentId: string }
  | { type: "segment_pause"; timestamp: number; segmentId: string }
  | { type: "segment_resume"; timestamp: number; segmentId: string }
  | { type: "audio_start"; timestamp: number }
  | { type: "audio_end"; timestamp: number }
  | { type: "reading_end"; timestamp: number }
  | { type: "verify_start"; timestamp: number }
  | { type: "verify_end"; timestamp: number }
  | { type: "operate_start"; timestamp: number }
  | { type: "operate_end"; timestamp: number }
  | { type: "note"; timestamp: number; text: string };

export interface AnnotatedFrame {
  frame: Frame;
  /** null durante baseline o fuori dalla lettura. */
  clauseId: string | null;
  /** Porzione visibile (solo nei modi a porzioni). */
  segmentId?: string | null;
  phase: "baseline" | "reading" | "verify" | "operate" | "idle";
  effort: EffortSample | null;
}

export interface Session {
  id: string;
  /** Pseudonimo generato: nessun dato identificativo. */
  participant: string;
  documentId: string;
  documentTitle: string;
  device: { name: string; simulated: boolean; firmwareVersion: string | null } | null;
  createdAt: number;
  consent: { accepted: boolean; timestamp: number | null };
  /** Come è stato presentato il testo. */
  reading?: { mode: "clausola" | "porzioni" | "scorrimento"; wordsPerMinute: number | null; voiceRecorded: boolean };
  events: NavigationEvent[];
  frames: AnnotatedFrame[];
  answers: AnswerRecord[];
  tasks: TaskRecord[];
}

export function newSessionId(): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `hm-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Pseudonimo leggibile ma non riconducibile: due parole + numero. */
export function newPseudonym(): string {
  const a = ["ulisse", "circe", "euriloco", "perimede", "nausicaa", "telemaco", "penelope", "calipso"];
  const b = ["albero", "cera", "vela", "remo", "scia", "faro", "corda", "nodo"];
  const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];
  return `${pick(a)}-${pick(b)}-${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * Divide un testo in clausole. Un titolo è una riga breve senza punto
 * finale seguita da un blocco; i blocchi sono separati da righe vuote.
 */
export function splitIntoClauses(raw: string): Clause[] {
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const clauses: Clause[] = [];
  let pendingHeading: string | null = null;
  for (const block of blocks) {
    if (looksLikeHeading(block)) {
      pendingHeading = block;
      continue;
    }
    const index = clauses.length + 1;
    clauses.push({
      id: `c${index}`,
      index,
      heading: pendingHeading,
      text: block,
      wordCount: countWords(block),
    });
    pendingHeading = null;
  }
  // Un titolo orfano in coda diventa comunque una clausola.
  if (pendingHeading) {
    const index = clauses.length + 1;
    clauses.push({ id: `c${index}`, index, heading: null, text: pendingHeading, wordCount: countWords(pendingHeading) });
  }
  return clauses;
}

function looksLikeHeading(block: string): boolean {
  if (block.includes("\n")) return false;
  if (block.length > 90) return false;
  return !/[.;:!?]$/.test(block);
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
