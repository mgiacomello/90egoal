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
  const [live, setLive] = useState<LivePoint[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [baseline, setBaseline] = useState<Baseline | null>(null);

  const source = useRef<MendiSource | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const session = useRef<Session | null>(null);
  const phaseRef = useRef<Phase>("setup");
  const clauseRef = useRef<string | null>(null);
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
      s?.frames.push({ frame, clauseId: clauseRef.current, phase: "reading", effort });
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
          await src.enableAutoCalibration().catch(() => log("Autocalibrazione non disponibile (non è bloccante)."));
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

  const disconnect = useCallback(async () => {
    await source.current?.disconnect();
    unsubscribe.current?.();
    source.current = null;
    setDevice(null);
    setBattery(null);
  }, []);

  const pushEvent = (ev: NavigationEvent) => session.current?.events.push(ev);

  /** Avvia la sessione: crea il record e passa alla baseline (o alla lettura senza fascia). */
  const start = useCallback((doc: Document) => {
    const now = Date.now();
    session.current = {
      id: newSessionId(),
      participant: newPseudonym(),
      documentId: doc.id,
      documentTitle: doc.title,
      device: device ? { name: device.name, simulated: device.simulated, firmwareVersion: device.firmwareVersion } : null,
      createdAt: now,
      consent: { accepted: true, timestamp: now },
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
    setPhase("reading");
  };

  /** Chiude la baseline; ritorna false se il segnale non basta. */
  const finishBaseline = useCallback((): boolean => {
    const b = computeBaseline(baselineFrames.current);
    if (!b) {
      setError("Baseline insufficiente: controlla che la fascia sia ben posizionata e riprova.");
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
    },
    [document],
  );

  /** Dopo la lettura: verifica se il documento ha domande, altrimenti prova operativa, altrimenti risultati. */
  const finishReading = useCallback(() => {
    const now = Date.now();
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
    setDocument(null);
    setClauseIndex(0);
    setLive([]);
    setFrameCount(0);
    setBaseline(null);
    setError(null);
    setPhase("setup");
  }, []);

  return {
    phase, device, battery, error, connecting, btLog, document, clauseIndex, live, frameCount, baseline,
    session: session.current,
    connect, disconnect, start, finishBaseline, goTo, finishReading, answerQuestion, finishVerify, completeTask, finishOperate, reset,
    clearError: () => setError(null),
  };
}
