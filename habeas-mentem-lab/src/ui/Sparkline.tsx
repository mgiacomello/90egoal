import type { LivePoint } from "./useRecorder";
import { MOTION_THRESHOLD_G } from "../mendi/signal";

/** Tracciato dell'indice di sforzo sull'ultimo minuto, con i movimenti evidenziati. */
export function Sparkline({ points, width = 640, height = 90 }: { points: LivePoint[]; width?: number; height?: number }) {
  if (points.length < 2) {
    return <div className="spark spark-empty" style={{ width, height }}>In attesa del segnale…</div>;
  }
  const values = points.map((p) => p.effort);
  const max = Math.max(...values.map(Math.abs), 0.01);
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => height / 2 - (v / max) * (height / 2 - 6);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.effort).toFixed(1)}`).join(" ");
  const artifacts = points
    .map((p, i) => (p.motion > MOTION_THRESHOLD_G ? i : -1))
    .filter((i) => i >= 0);
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Indice di sforzo dal vivo">
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} className="spark-zero" />
      {artifacts.map((i) => (
        <rect key={i} x={x(i) - 1} y={0} width={2} height={height} className="spark-motion" />
      ))}
      <path d={path} className="spark-line" />
      <text x={4} y={12} className="spark-label">+{max.toFixed(3)}</text>
      <text x={4} y={height - 4} className="spark-label">−{max.toFixed(3)}</text>
    </svg>
  );
}
