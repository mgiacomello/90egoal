// Il registratore: tiene insieme fascia, baseline, sessione e navigazione.
//
// I frame arrivano a ~25 Hz: li accumuliamo in ref mutabili e aggiorniamo
// lo stato React solo poche volte al secondo per il tracciato dal vivo.

import { useCallback, useEffect, useRef, useState } from "react";
import { SimulatedMendi } from "../mendi/simulated";
import { explainBluetoothError, WebBluetoothMendi } from "../mendi/webbluetooth";
import {
  computeBaseline,
  effortFromFrame,
  MovingAverage,
  type Baseline,
  type EffortSample,
} from "../mendi/signal";
import type { AdcReading, DeviceInfo, Frame, MendiSource } from "../mendi/types";
import { newPseudonym, newSessionId, type Document, type NavigationEvent, type Question, type Session, type Task } from "../session/model";
import { segmentsFor, type ReadingMode, type Segment } from "../session/segments";

export interface ReadingOptions {
  mode: ReadingMode;
  /** Ritmo del modo a scorrimento (parole al minuto). */
  wordsPerMinute: number;
  /** Registra la voce durante la lettura (lettura ad alta voce). */
  recordVoice: boolean;
}

export const DEFAULT_READING: ReadingOptions = { mode: "clausola", wordsPerMinute: 180, recordVoice: false };

export type Phase = "setup" | "baseline" | "reading" | "verify" | "operate" | "results";

export interface LivePoint {
  timestamp: number;
  effort: number;
  motion: number;
}

export function useRecorder() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [battery, setBattery] = useState<AdcReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [btLog, setBtLog] = useState<string[]>([]);
  const [document, setDocument] = useState<Document | null>(null);
  const [clauseIndex, setClauseIndex] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [reading, setReading] = useState<ReadingOptions>(DEFAULT_READING);
  const [paused, setPaused] = useState(false);
  const [audio, setAudio] = useState<{ blob: Blob; startedAt: number } | null>(null);
  const [live, setLive] = useState<LivePoint[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [baseline, setBaseline] = useState<Baseline | null>(null);

  const source = useRef<MendiSource | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const session = useRef<Session | null>(null);
  const phaseRef = useRef<Phase>("setup");
  const clauseRef = useRef<string | null>(null);
  const segmentRef = useRef<string | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const readingRef = useRef<ReadingOptions>(DEFAULT_READING);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const baselineFrames = useRef<Frame[]>([]);
  const baselineRef = useRef<Baseline | null>(null);
  const smoother = useRef(new MovingAverage(25));
  const liveBuf = useRef<LivePoint[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const onFrame = useCallback((frame: Frame) => {
    const s = session.current;
    const p = phaseRef.current;
    counter.current++;
    let effort: EffortSample | null = null;

    if (p === "baseline") {
      baselineFrames.current.push(frame);
      s?.frames.push({ frame, clauseId: null, phase: "baseline", effort: null });
    } else if (p === "reading" && baselineRef.current) {
      effort = effortFromFrame(frame, baselineRef.current);
      s?.frames.push({ frame, clauseId: clauseRef.current, segmentId: segmentRef.current, phase: "reading", effort });
    } else if ((p === "verify" || p === "operate") && baselineRef.current) {
      // Registriamo anche durante verifica e prova operativa, senza clausola:
      // il segnale qui non entra nelle metriche per clausola.
      effort = effortFromFrame(frame, baselineRef.current);
      s?.frames.push({ frame, clauseId: null, phase: p, effort });
    } else {
      return; // fuori dalle fasi utili non registriamo nulla
    }

    if (effort) {
      const smoothed = smoother.current.push(effort.effort);
      liveBuf.current.push({ timestamp: frame.timestamp, effort: smoothed, motion: effort.motion });
      if (liveBuf.current.length > 25 * 60) liveBuf.current.shift(); // ultimo minuto
    }
    if (counter.current % 5 === 0) {
      setLive([...liveBuf.current]);
      setFrameCount(s?.frames.length ?? 0);
    }
  }, []);

  const attach = useCallback(
    (src: MendiSource) => {
      unsubscribe.current?.();
      unsubscribe.current = src.subscribe((ev) => {
        if (ev.type === "frame") onFrame(ev.frame);
        else if (ev.type === "battery") setBattery(ev.reading);
        else if (ev.type === "connected") setDevice(ev.device);
        else if (ev.type === "disconnected") {
          setDevice(null);
          setError("La fascia si è disconnessa. Puoi ricollegarla o continuare senza.");
        } else if (ev.type === "error") setError(ev.message);
      });
      source.current = src;
    },
    [onFrame],
  );

  const connect = useCallback(
    async (simulated: boolean, acceptAllDevices = false) => {
      setError(null);
      setConnecting(true);
      setBtLog([]);
      const log = (line: string) => setBtLog((prev) => [...prev, `${new Date().toLocaleTimeString("it-IT")} ${line}`]);
      try {
        const src = simulated ? new SimulatedMendi() : new WebBluetoothMendi();
        attach(src);
        if (src instanceof WebBluetoothMendi) {
          await src.connect({ acceptAllDevices, log });
        } else {
          await src.connect();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const name = (e as { name?: string })?.name ?? "";
        log(`Errore ${name || "sconosciuto"}: ${msg}`);
        // L'utente ha chiuso la finestra di scelta: non è un errore.
        if (!(name === "NotFoundError" && /cancel/i.test(msg))) setError(explainBluetoothError(e));
        source.current = null;
      } finally {
        setConnecting(false);
      }
    },
    [attach],
  );

  /** Contatore grezzo dei campioni ricevuti dalla fascia (anche fuori dalle fasi registrate). */
  const [received, setReceived] = useState(0);
  useEffect(() => {
    if (!device) return;
    const t = setInterval(() => {
      const src = source.current;
      if (src instanceof WebBluetoothMendi) setReceived(src.frameCount);
      else if (src) setReceived((n) => n + 25);
    }, 1000);
    return () => clearInterval(t);
  }, [device]);

  /** Riaccende LED e sensore a mano (tasto nella schermata iniziale). */
  const wake = useCallback(async () => {
    const src = source.current;
    if (src instanceof WebBluetoothMendi) {
      await src.readDiagnostics();
      await src.wakeUp();
    }
  }, []);

  /** Sonda di accensione (tasto nella schermata iniziale). */
  const probe = useCallback(async () => {
    const src = source.current;
    if (!(src instanceof WebBluetoothMendi)) return;
    const log = (line: string) => setBtLog((prev) => [...prev, `${new Date().toLocaleTimeString("it-IT")} ${line}`]);
    log("Avvio la sonda…");
    try {
      const { runProbe } = await import("../mendi/probe");
      await runProbe(src, log);
    } catch (e) {
      log(`Sonda interrotta: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await source.current?.disconnect();
    unsubscribe.current?.();
    source.current = null;
    setDevice(null);
    setBattery(null);
  }, []);

  const pushEvent = (ev: NavigationEvent) => session.current?.events.push(ev);

  /** Avvia la sessione: crea il record e passa alla baseline (o alla lettura senza fascia). */
  const start = useCallback((doc: Document, options: ReadingOptions = DEFAULT_READING) => {
    const now = Date.now();
    readingRef.current = options;
    setReading(options);
    segmentsRef.current = options.mode === "clausola" ? [] : segmentsFor(doc.clauses);
    session.current = {
      id: newSessionId(),
      participant: newPseudonym(),
      documentId: doc.id,
      documentTitle: doc.title,
      device: device ? { name: device.name, simulated: device.simulated, firmwareVersion: device.firmwareVersion } : null,
      createdAt: now,
      consent: { accepted: true, timestamp: now },
      reading: { mode: options.mode, wordsPerMinute: options.mode === "scorrimento" ? options.wordsPerMinute : null, voiceRecorded: options.recordVoice },
      events: [],
      frames: [],
      answers: [],
      tasks: [],
    };
    setDocument(doc);
    baselineFrames.current = [];
    baselineRef.current = null;
    setBaseline(null);
    liveBuf.current = [];
    smoother.current.reset();
    setLive([]);
    setFrameCount(0);
    if (device) {
      pushEvent({ type: "baseline_start", timestamp: now });
      setPhase("baseline");
    } else {
      beginReading(doc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  const beginReading = (doc: Document) => {
    const now = Date.now();
    const first = doc.clauses[0];
    clauseRef.current = first.id;
    setClauseIndex(0);
    pushEvent({ type: "clause_enter", timestamp: now, clauseId: first.id, direction: "start" });
    if (segmentsRef.current.length > 0) {
      const seg = segmentsRef.current.find((x) => x.clauseId === first.id)!;
      segmentRef.current = seg.id;
      setSegmentIndex(0);
      pushEvent({ type: "segment_enter", timestamp: now, clauseId: first.id, segmentId: seg.id, direction: "start" });
    }
    setPaused(false);
    if (readingRef.current.recordVoice) void startAudio();
    setPhase("reading");
  };

  /** Registrazione vocale: resta nel browser, come tutto il resto. */
  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      const startedAt = Date.now();
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudio({ blob: new Blob(audioChunks.current, { type: rec.mimeType || "audio/webm" }), startedAt });
        pushEvent({ type: "audio_end", timestamp: Date.now() });
      };
      rec.start(1000);
      recorder.current = rec;
      pushEvent({ type: "audio_start", timestamp: startedAt });
    } catch (e) {
      setError(`Microfono non disponibile: ${e instanceof Error ? e.message : String(e)}. La lettura prosegue senza registrazione.`);
    }
  };

  const stopAudio = () => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorder.current = null;
  };

  /** Chiude la baseline; ritorna false se il segnale non basta. */
  const finishBaseline = useCallback((): boolean => {
    const b = computeBaseline(baselineFrames.current);
    if (!b) {
      const n = baselineFrames.current.length;
      const src = source.current;
      if (n === 0 && src instanceof WebBluetoothMendi) {
        // Collegata ma muta: riprovo ad accendere il sensore ottico prima della nuova baseline.
        src.wakeUp().catch(() => undefined);
        setError("La fascia è collegata ma non ha inviato campioni in 30 s. Ho rimandato l'accensione (calibrazione + sensore): riprova la baseline. Se resta a zero, spegni e riaccendi la fascia, poi «scollega» e ricollega; il log nero dice che cosa risponde.");
      } else {
        setError(`Baseline insufficiente: ${n} campioni ricevuti, ma con luce ambiente troppo alta o sensori scoperti. Controlla che la fascia aderisca alla fronte, lontano da luce diretta, e riprovo.`);
      }
      baselineFrames.current = [];
      return false;
    }
    baselineRef.current = b;
    setBaseline(b);
    pushEvent({ type: "baseline_end", timestamp: Date.now() });
    if (document) beginReading(document);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

  const goTo = useCallback(
    (nextIndex: number, direction: "forward" | "back") => {
      if (!document) return;
      const now = Date.now();
      const from = clauseRef.current;
      const to = document.clauses[nextIndex];
      if (!to) return;
      if (from) pushEvent({ type: "clause_leave", timestamp: now, clauseId: from });
      pushEvent({ type: "clause_enter", timestamp: now, clauseId: to.id, direction });
      clauseRef.current = to.id;
      setClauseIndex(nextIndex);
      const segs = segmentsRef.current.filter((x) => x.clauseId === to.id);
      if (segs.length > 0) {
        const seg = direction === "back" ? segs[segs.length - 1] : segs[0];
        segmentRef.current = seg.id;
        setSegmentIndex(seg.index);
        pushEvent({ type: "segment_enter", timestamp: now, clauseId: to.id, segmentId: seg.id, direction });
      }
    },
    [document],
  );

  /**
   * Avanza o torna di una porzione. Ai bordi della clausola passa alla
   * clausola vicina. Ritorna false se non c'è più nulla dopo (fine lettura).
   */
  const stepSegment = useCallback(
    (direction: "forward" | "back" | "auto"): boolean => {
      if (!document || !clauseRef.current) return false;
      const segs = segmentsRef.current.filter((x) => x.clauseId === clauseRef.current);
      const cur = segs.find((x) => x.id === segmentRef.current);
      if (!cur) return false;
      const now = Date.now();
      const nextIdx = direction === "back" ? cur.index - 1 : cur.index + 1;
      const next = segs[nextIdx];
      if (next) {
        pushEvent({ type: "segment_leave", timestamp: now, segmentId: cur.id });
        segmentRef.current = next.id;
        setSegmentIndex(next.index);
        pushEvent({ type: "segment_enter", timestamp: now, clauseId: cur.clauseId, segmentId: next.id, direction });
        return true;
      }
      const ci = document.clauses.findIndex((c) => c.id === cur.clauseId);
      if (direction === "back") {
        if (ci > 0) goTo(ci - 1, "back");
        return true;
      }
      if (ci < document.clauses.length - 1) {
        goTo(ci + 1, "forward");
        return true;
      }
      return false;
    },
    [document, goTo],
  );

  /** Fermata nel modo a scorrimento: è un segnale (la persona ha chiesto tempo). */
  const togglePause = useCallback(() => {
    if (!segmentRef.current) return;
    const now = Date.now();
    setPaused((p) => {
      pushEvent({ type: p ? "segment_resume" : "segment_pause", timestamp: now, segmentId: segmentRef.current! });
      return !p;
    });
  }, []);

  /** Dopo la lettura: verifica se il documento ha domande, altrimenti prova operativa, altrimenti risultati. */
  const finishReading = useCallback(() => {
    const now = Date.now();
    if (segmentRef.current) pushEvent({ type: "segment_leave", timestamp: now, segmentId: segmentRef.current });
    segmentRef.current = null;
    stopAudio();
    if (clauseRef.current) pushEvent({ type: "clause_leave", timestamp: now, clauseId: clauseRef.current });
    pushEvent({ type: "reading_end", timestamp: now });
    clauseRef.current = null;
    if (document && document.questions.length > 0) {
      pushEvent({ type: "verify_start", timestamp: now });
      setPhase("verify");
    } else if (document && document.tasks.length > 0) {
      pushEvent({ type: "operate_start", timestamp: now });
      setPhase("operate");
    } else {
      setPhase("results");
    }
  }, [document]);

  const answerQuestion = useCallback(
    (question: Question, chosenIndex: number, ms: number) => {
      session.current?.answers.push({
        questionId: question.id,
        clauseId: question.clauseId,
        chosenIndex,
        correct: chosenIndex === question.correctIndex,
        timestamp: Date.now(),
        ms,
      });
    },
    [],
  );

  const finishVerify = useCallback(() => {
    const now = Date.now();
    pushEvent({ type: "verify_end", timestamp: now });
    if (document && document.tasks.length > 0) {
      pushEvent({ type: "operate_start", timestamp: now });
      setPhase("operate");
    } else {
      setPhase("results");
    }
  }, [document]);

  const completeTask = useCallback((task: Task, chosenClauseId: string, ms: number, opened: number) => {
    session.current?.tasks.push({
      taskId: task.id,
      clauseId: task.clauseId,
      chosenClauseId,
      correct: chosenClauseId === task.clauseId,
      timestamp: Date.now(),
      ms,
      opened,
    });
  }, []);

  const finishOperate = useCallback(() => {
    pushEvent({ type: "operate_end", timestamp: Date.now() });
    setPhase("results");
  }, []);

  const reset = useCallback(() => {
    session.current = null;
    stopAudio();
    setAudio(null);
    segmentsRef.current = [];
    segmentRef.current = null;
    setSegmentIndex(0);
    setPaused(false);
    setDocument(null);
    setClauseIndex(0);
    setLive([]);
    setFrameCount(0);
    setBaseline(null);
    setError(null);
    setPhase("setup");
  }, []);

  return {
    phase, device, battery, error, connecting, btLog, document, clauseIndex, live, frameCount, baseline, received,
    segmentIndex, reading, paused, audio,
    segments: segmentsRef.current,
    session: session.current,
    connect, disconnect, wake, probe, stepSegment, togglePause, start, finishBaseline, goTo, finishReading, answerQuestion, finishVerify, completeTask, finishOperate, reset,
    clearError: () => setError(null),
  };
}
