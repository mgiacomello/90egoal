// Il percorso della sessione, come i livelli di un gioco: dove sei, cosa manca.

import type { Phase } from "./useRecorder";

const STEPS: { key: Phase | "verify" | "operate"; label: string; short: string }[] = [
  { key: "setup", label: "Consenso", short: "1" },
  { key: "baseline", label: "Baseline", short: "2" },
  { key: "reading", label: "Lettura", short: "3" },
  { key: "verify", label: "Verifica", short: "4" },
  { key: "operate", label: "Prova", short: "5" },
  { key: "results", label: "Risultati", short: "6" },
];

export function Stepper({ phase, skip = [] }: { phase: Phase; skip?: string[] }) {
  const order = STEPS.filter((s) => !skip.includes(s.key));
  // La pausa di fissazione fa parte della lettura.
  const effective = phase === "rest" ? "reading" : phase;
  const current = Math.max(0, order.findIndex((s) => s.key === effective));
  return (
    <ol className="stepper" aria-label="Percorso della sessione">
      {order.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s.key} className={`step ${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-bar" />
            <span className="step-label">{state === "done" ? "✓ " : ""}{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
