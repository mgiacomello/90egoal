// Fascicolo aggregato: importa i JSON di più sessioni sullo stesso documento.

import { useState } from "react";
import { AGGREGATE_THRESHOLDS, aggregateSessions, AggregateError, parseSessionExport, type Aggregate, type SessionExport } from "../session/aggregate";
import { download } from "../session/export";
import { LX_ACCESSIBILITY_THRESHOLD } from "../session/lx";

export function AggregateScreen({ onBack }: { onBack: () => void }) {
  const [files, setFiles] = useState<{ name: string; data: SessionExport }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [responsible, setResponsible] = useState("");
  const [building, setBuilding] = useState(false);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    const errs: string[] = [];
    for (const f of Array.from(list)) {
      try {
        const data = parseSessionExport(await f.text(), f.name);
        if (next.some((x) => x.data.session.id === data.session.id)) {
          errs.push(`${f.name}: sessione ${data.session.id} già importata.`);
          continue;
        }
        next.push({ name: f.name, data });
      } catch (e) {
        errs.push(e instanceof Error ? e.message : String(e));
      }
    }
    setFiles(next);
    setErrors(errs);
    recompute(next);
  };

  const recompute = (list: { name: string; data: SessionExport }[]) => {
    if (list.length === 0) {
      setAggregate(null);
      return;
    }
    try {
      setAggregate(aggregateSessions(list.map((x) => x.data)));
    } catch (e) {
      setAggregate(null);
      setErrors((prev) => [...prev, e instanceof AggregateError ? e.message : String(e)]);
    }
  };

  const remove = (id: string) => {
    const next = files.filter((x) => x.data.session.id !== id);
    setFiles(next);
    setErrors([]);
    recompute(next);
  };

  const makeDossier = async () => {
    if (!aggregate) return;
    setBuilding(true);
    try {
      const json = JSON.stringify({ schema: "habeas-mentem-lab/aggregate/v1", exportedAt: new Date().toISOString(), aggregate }, null, 2);
      const { buildAggregateDossier } = await import("../session/dossier");
      const blob = await buildAggregateDossier({ aggregate, aggregateJson: json, responsible });
      download(`${aggregate.documentId}-aggregato-${aggregate.sessions}-lettori.pdf`, blob);
    } finally {
      setBuilding(false);
    }
  };

  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const T = AGGREGATE_THRESHOLDS;

  return (
    <main className="screen">
      <p className="eyebrow">Fascicolo aggregato</p>
      <h1>Dove i lettori si perdono</h1>
      <p className="lead">
        Importa i JSON di più sessioni sullo stesso documento. La mappa della frizione qui è calcolata tra lettori,
        in forma aggregata e anonima: conta quanti erano, non chi. «Chi non può permettersi un laboratorio può sempre
        permettersi un cronometro e cinque lettori veri.»
      </p>

      <section className="card">
        <h2>Sessioni</h2>
        <input id="aggregate-files" type="file" accept="application/json,.json" multiple onChange={(e) => addFiles(e.target.files)} />
        {files.length > 0 && (
          <ul className="files">
            {files.map((f) => (
              <li key={f.data.session.id}>
                <code>{f.data.session.id}</code> · {f.data.session.documentTitle}
                {f.data.session.device ? ` · ${f.data.session.device.name}${f.data.session.device.simulated ? " (simulata)" : ""}` : " · senza fascia"}{" "}
                <button onClick={() => remove(f.data.session.id)}>togli</button>
              </li>
            ))}
          </ul>
        )}
        {errors.length > 0 && (
          <ul className="errors">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </section>

      {aggregate && (
        <>
          <p className="lead">
            <strong>{aggregate.sessions} lettori</strong> · {aggregate.documentTitle} · {aggregate.sessionsWithSignal} con segnale
            {aggregate.simulatedSessions > 0 && ` · ${aggregate.simulatedSessions} con fascia simulata`}
          </p>
          <div className="legend">
            <span className="friction verde">verde</span>
            <span className="friction giallo">giallo: due indizi, o verifica/prova sotto soglia</span>
            <span className="friction rosso">rosso: tre indizi, di cui uno da verifica o prova</span>
          </div>
          <div className="table-wrap">
            <table className="metrics">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Clausola</th>
                  <th>Frizione</th>
                  <th>Lettori</th>
                  <th>Tempo mediano</th>
                  <th>Troppo veloci</th>
                  <th>Tornati</th>
                  <th>LX</th>
                  <th>Verifica</th>
                  <th>Prova</th>
                  {aggregate.sessionsWithSignal > 0 && <th>Sforzo (n)</th>}
                  <th>Persi</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.clauses.map((c) => (
                  <tr key={c.clauseId}>
                    <td>{c.index}</td>
                    <td>{c.heading ?? "—"}</td>
                    <td>
                      <span className={`friction ${c.friction.level}`} title={c.friction.reasons.join("\n") || "nessun indizio"}>
                        {c.friction.level}
                        {c.friction.count > 0 && <span className="hint">({c.friction.count})</span>}
                      </span>
                    </td>
                    <td>{c.readers}</td>
                    <td>{(c.dwellMedianMs / 1000).toFixed(1)} s</td>
                    <td className={c.tooFastShare >= T.timeShare ? "ko" : ""}>{pct(c.tooFastShare)}</td>
                    <td>{pct(c.returnedShare)}</td>
                    <td>
                      <span className={`lx ${c.lx.total > LX_ACCESSIBILITY_THRESHOLD ? "lx-high" : "lx-ok"}`}>{c.lx.total}</span>
                    </td>
                    <td className={c.friction.indicators.verify ? "ko" : c.verification.asked ? "ok" : ""}>
                      {c.verification.asked ? `${c.verification.correct}/${c.verification.asked}` : "—"}
                    </td>
                    <td className={c.friction.indicators.operate ? "ko" : c.operational.asked ? "ok" : ""}>
                      {c.operational.asked ? `${c.operational.correct}/${c.operational.asked}` : "—"}
                      {c.operational.timesChosenWrongly > 0 && <span className="flag"> ✕{c.operational.timesChosenWrongly}</span>}
                    </td>
                    {aggregate.sessionsWithSignal > 0 && (
                      <td>{c.effort.mean === null ? "—" : `${c.effort.mean.toFixed(4)} (${c.effort.readersWithSignal})`}</td>
                    )}
                    <td>{pct(c.lostShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Persi = quota di lettori per cui la clausola era gialla o rossa nella propria sessione. Il tempo conta come
            indizio se almeno il {Math.round(T.timeShare * 100)}% dei lettori è stato troppo veloce o è tornato indietro;
            verifica e prova contano con almeno {T.minAnswers} risposte e sotto il {Math.round(T.verifyAccuracy * 100)}%; il
            corpo con almeno {T.minSignalReaders} lettori con segnale.
          </p>

          <section className="card dossier">
            <h2>Il fascicolo aggregato</h2>
            <div className="row">
              <input
                id="aggregate-responsible"
                placeholder="Chi risponde di questo documento (il nome sul cartello)"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
              />
              <button className="primary" disabled={building} onClick={makeDossier}>
                {building ? "Genero il fascicolo…" : "Genera il fascicolo aggregato (PDF)"}
              </button>
            </div>
          </section>
        </>
      )}

      <div className="actions">
        <button onClick={onBack}>← Torna alla sessione</button>
      </div>
    </main>
  );
}
