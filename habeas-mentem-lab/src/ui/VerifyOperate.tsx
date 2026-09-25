// Gli occhi "verifica" e "prova operativa": domande dopo la lettura e
// compiti pratici che chiedono di ritrovare la clausola che serve.
//
// La verifica misura ciò che è rimasto; la prova operativa misura l'unica
// cosa che al diritto davvero importa: la persona sa usare ciò che ha letto?

import { useEffect, useState } from "react";
import type { Document, Question, Task } from "../session/model";

interface VerifyProps {
  doc: Document;
  onAnswer: (question: Question, chosenIndex: number, ms: number) => void;
  onDone: () => void;
}

export function Verify({ doc, onAnswer, onDone }: VerifyProps) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [shownAt, setShownAt] = useState(Date.now());
  const question = doc.questions[index];

  useEffect(() => {
    setShownAt(Date.now());
    setChosen(null);
  }, [index]);

  const confirm = () => {
    if (chosen === null) return;
    onAnswer(question, chosen, Date.now() - shownAt);
    if (index + 1 < doc.questions.length) setIndex(index + 1);
    else onDone();
  };

  return (
    <main className="screen">
      <div className="progress">
        <span>Verifica · domanda {index + 1} di {doc.questions.length}</span>
        <span>senza rileggere il documento</span>
      </div>
      <article className="clause quiz">
        <p className="prompt">{question.prompt}</p>
        <div className="options">
          {question.options.map((opt, i) => (
            <label key={i} className={`option ${chosen === i ? "chosen" : ""}`}>
              <input type="radio" name={`q-${question.id}`} checked={chosen === i} onChange={() => setChosen(i)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </article>
      <nav className="actions">
        <button className="primary" disabled={chosen === null} onClick={confirm}>
          {index + 1 < doc.questions.length ? "Conferma e avanti →" : "Conferma"}
        </button>
      </nav>
      <p className="hint">
        Nessuna risposta viene mostrata come giusta o sbagliata: la verifica serve a diagnosticare il documento, non a
        dare un voto a chi legge.
      </p>
    </main>
  );
}

interface OperateProps {
  doc: Document;
  onComplete: (task: Task, chosenClauseId: string, ms: number, opened: number) => void;
  onDone: () => void;
}

export function Operate({ doc, onComplete, onDone }: OperateProps) {
  const [index, setIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [opened, setOpened] = useState(0);
  const [shownAt, setShownAt] = useState(Date.now());
  const task = doc.tasks[index];

  useEffect(() => {
    setShownAt(Date.now());
    setOpenId(null);
    setOpened(0);
  }, [index]);

  const open = (id: string) => {
    if (openId !== id) setOpened((n) => n + 1);
    setOpenId(openId === id ? null : id);
  };

  const choose = () => {
    if (!openId) return;
    onComplete(task, openId, Date.now() - shownAt, opened);
    if (index + 1 < doc.tasks.length) setIndex(index + 1);
    else onDone();
  };

  const current = doc.clauses.find((c) => c.id === openId);

  return (
    <main className="screen">
      <div className="progress">
        <span>Prova operativa · compito {index + 1} di {doc.tasks.length}</span>
        <span>puoi riaprire il documento</span>
      </div>
      <article className="clause quiz">
        <p className="prompt">{task.prompt}</p>
        <p className="hint">Apri le clausole che ti servono, poi conferma quella giusta.</p>
        <div className="clause-list">
          {doc.clauses.map((c) => (
            <div key={c.id} className={`clause-item ${openId === c.id ? "open" : ""}`}>
              <button className="clause-toggle" onClick={() => open(c.id)}>
                <span className="clause-num">{c.index}</span>
                <span>{c.heading ?? c.text.slice(0, 70) + "…"}</span>
              </button>
              {openId === c.id && current && <div className="clause-body">{current.text}</div>}
            </div>
          ))}
        </div>
      </article>
      <nav className="actions">
        <button className="primary" disabled={!openId} onClick={choose}>
          {openId ? `È la clausola ${current?.index}` : "Apri una clausola"}
          {index + 1 < doc.tasks.length ? " →" : ""}
        </button>
      </nav>
    </main>
  );
}
