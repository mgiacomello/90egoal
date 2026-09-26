import type { LivePoint } from "./useRecorder";
import { isArtifact } from "../mendi/signal";

/** Tracciato dell'indice di sforzo sull'ultimo minuto, con i movimenti evidenziati. */
export function Sparkline({ points, width = 640, height = 90 }: { points: LivePoint[]; width?: number; height?: number }) {
  if (points.length < 2) {
    return <div className="spark spark-empty">In attesa del segnale…</div>;
  }
  // Vista dal vivo detrendizzata: togliamo la media della finestra, così la deriva lenta non schiaccia le variazioni.
  const mean = points.reduce((s, p) => s + p.effort, 0) / points.length;
  const values = points.map((p) => p.effort - mean);
  const max = Math.max(...values.map(Math.abs), 0.01);
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => height / 2 - (v / max) * (height / 2 - 6);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height / 2} L0,${height / 2} Z`;
  const artifacts = points
    .map((p, i) => (isArtifact(p) ? i : -1))
    .filter((i) => i >= 0);
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label="Indice di sforzo dal vivo">
      <path d={area} className="spark-area" />
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} className="spark-zero" />
      {artifacts.map((i) => (
        <rect key={i} x={x(i) - 1} y={0} width={2} height={height} className="spark-motion" />
      ))}
      <path d={path} className="spark-line" />
      {points.length > 130 && (() => {
        const xi = x(points.length - 1 - 125);
        return (
          <g className="spark-lag">
            <line x1={xi} x2={xi} y1={0} y2={height} className="spark-lagline" />
            <text x={xi + 4} y={height - 4} className="spark-label">5 s fa</text>
          </g>
        );
      })()}
      <text x={4} y={12} className="spark-label">+{max.toFixed(2)} µM</text>
      <text x={4} y={height - 4} className="spark-label">−{max.toFixed(2)} µM</text>
    </svg>
  );
}
