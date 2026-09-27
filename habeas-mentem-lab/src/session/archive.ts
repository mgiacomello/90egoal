// L'archivio del team: sessioni condivise e modello appreso.
//
// Il laboratorio parla con due indirizzi dello stesso sito:
//   POST /api/lab/sessions   deposita una sessione (senza tracciato grezzo, senza pseudonimo)
//   GET  /api/lab/model      restituisce il modello appreso, ricalcolato quando ci sono sessioni nuove
//
// La chiave del team sta in questo browser (localStorage). Se la rete manca,
// la sessione resta in coda e parte alla prossima apertura. Il modello viene
// conservato in locale: senza rete vale l'ultimo ricevuto.

import { isLabModel, type LabModel } from "./learning";

const KEY_STORAGE = "hm-lab-archive-key";
const QUEUE_STORAGE = "hm-lab-archive-queue";
const MODEL_STORAGE = "hm-lab-model-cache";
const SENT_STORAGE = "hm-lab-archive-sent";

export const ARCHIVE_ENDPOINTS = { sessions: "/api/lab/sessions", model: "/api/lab/model" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Senza localStorage l'archivio resta raggiungibile, ma senza coda né cache.
  }
}

export function archiveKey(): string {
  return read<string>(KEY_STORAGE, "");
}
export function setArchiveKey(key: string): void {
  write(KEY_STORAGE, key.trim());
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const k = archiveKey();
  if (k) h["x-lab-key"] = k;
  return h;
}

export interface ArchiveInfo {
  /** L'archivio risponde. */
  reachable: boolean;
  /** Configurato lato server (tabella e credenziali presenti). */
  configured: boolean;
  /** La chiave di questo browser è accettata. */
  authorized: boolean;
  sessions: number;
  documents: number;
  message: string | null;
}

/** Stato dell'archivio, per la schermata iniziale. */
export async function archiveInfo(): Promise<ArchiveInfo> {
  try {
    const res = await fetch(`${ARCHIVE_ENDPOINTS.sessions}?summary=1`, { headers: headers(), cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { sessions?: number; documents?: number; error?: string; configured?: boolean };
    if (res.status === 401 || res.status === 403) return { reachable: true, configured: true, authorized: false, sessions: 0, documents: 0, message: body.error ?? "Chiave del team non accettata." };
    if (res.status === 503) return { reachable: true, configured: false, authorized: true, sessions: 0, documents: 0, message: body.error ?? "Archivio non configurato sul server." };
    if (res.status === 404 || res.status === 405) return { reachable: true, configured: false, authorized: true, sessions: 0, documents: 0, message: "API dell'archivio assente su questo indirizzo (anteprima locale)." };
    if (!res.ok) return { reachable: true, configured: true, authorized: true, sessions: 0, documents: 0, message: body.error ?? `Errore ${res.status}.` };
    return { reachable: true, configured: true, authorized: true, sessions: body.sessions ?? 0, documents: body.documents ?? 0, message: null };
  } catch {
    return { reachable: false, configured: false, authorized: false, sessions: 0, documents: 0, message: "Archivio non raggiungibile (rete o sito in locale)." };
  }
}

export type UploadOutcome = "archiviata" | "in coda" | "già archiviata" | "rifiutata";

function sentIds(): string[] {
  return read<string[]>(SENT_STORAGE, []);
}
function markSent(id: string): void {
  write(SENT_STORAGE, [...sentIds().filter((x) => x !== id), id].slice(-500));
}

async function post(json: string): Promise<{ ok: boolean; permanent: boolean; error: string | null }> {
  try {
    const res = await fetch(ARCHIVE_ENDPOINTS.sessions, { method: "POST", headers: headers(), body: json });
    if (res.ok) return { ok: true, permanent: false, error: null };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // 4xx: non cambierà riprovando (chiave, schema); 5xx: riprovare più tardi.
    return { ok: false, permanent: res.status >= 400 && res.status < 500 && res.status !== 429, error: body.error ?? `Errore ${res.status}` };
  } catch (e) {
    return { ok: false, permanent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Deposita la sessione (il JSON dell'esportazione). In caso di rete assente resta in coda. */
export async function uploadSession(sessionId: string, json: string): Promise<{ outcome: UploadOutcome; error: string | null }> {
  if (sentIds().includes(sessionId)) return { outcome: "già archiviata", error: null };
  const r = await post(json);
  if (r.ok) {
    markSent(sessionId);
    return { outcome: "archiviata", error: null };
  }
  if (r.permanent) return { outcome: "rifiutata", error: r.error };
  const queue = read<{ id: string; json: string }[]>(QUEUE_STORAGE, []).filter((q) => q.id !== sessionId);
  queue.push({ id: sessionId, json });
  write(QUEUE_STORAGE, queue.slice(-20));
  return { outcome: "in coda", error: r.error };
}

/** Riprova le sessioni rimaste in coda. Restituisce quante sono partite. */
export async function flushQueue(): Promise<number> {
  const queue = read<{ id: string; json: string }[]>(QUEUE_STORAGE, []);
  if (queue.length === 0) return 0;
  let sent = 0;
  const remaining: { id: string; json: string }[] = [];
  for (const q of queue) {
    const r = await post(q.json);
    if (r.ok) {
      markSent(q.id);
      sent++;
    } else if (!r.permanent) remaining.push(q);
  }
  write(QUEUE_STORAGE, remaining);
  return sent;
}

export function queuedCount(): number {
  return read<{ id: string }[]>(QUEUE_STORAGE, []).length;
}

/** Il modello appreso: dalla rete se possibile, altrimenti l'ultimo ricevuto. */
export async function loadModel(): Promise<{ model: LabModel | null; fromCache: boolean }> {
  try {
    const res = await fetch(ARCHIVE_ENDPOINTS.model, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { model?: unknown };
      if (isLabModel(body.model)) {
        write(MODEL_STORAGE, body.model);
        return { model: body.model, fromCache: false };
      }
    }
  } catch {
    // rete assente: sotto
  }
  const cached = read<unknown>(MODEL_STORAGE, null);
  return { model: isLabModel(cached) ? cached : null, fromCache: true };
}

export function cachedModel(): LabModel | null {
  const cached = read<unknown>(MODEL_STORAGE, null);
  return isLabModel(cached) ? cached : null;
}

export interface ArchiveDocument {
  documentId: string;
  documentTitle: string;
  sessions: number;
  real: number;
  withSignal: number;
  last: string;
}

/** I documenti in archivio, con quante sessioni ciascuno. */
export async function archiveDocuments(): Promise<ArchiveDocument[]> {
  try {
    const res = await fetch(`${ARCHIVE_ENDPOINTS.sessions}?summary=1`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { byDocument?: ArchiveDocument[] };
    return body.byDocument ?? [];
  } catch {
    return [];
  }
}

/** Le sessioni archiviate di un documento (esportazioni senza tracciato), per il fascicolo aggregato. */
export async function archiveSessions(documentId: string): Promise<unknown[]> {
  const res = await fetch(`${ARCHIVE_ENDPOINTS.sessions}?document=${encodeURIComponent(documentId)}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Errore ${res.status}`);
  }
  const body = (await res.json()) as { sessions?: unknown[] };
  return body.sessions ?? [];
}
