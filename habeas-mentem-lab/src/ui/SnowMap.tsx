// La cartografia della comprensione, come nella Tavola XIII del libro:
// una pagina di righe, una per clausola, e i trattini che si addensano
// attorno alle righe dove chi legge si perde, come i morti di colera di
// Snow attorno alla pompa di Broad Street. Il colore di stato resta, con
// l'etichetta; i trattini sono il dato: uno per indizio (sessione singola)
// o uno per lettore perso (aggregato).

import { useMemo, useState } from "react";
import type { FrictionLevel } from "../session/friction";

export interface MapItem {
  clauseId: string;
  index: number;
  heading: string | null;
  level: FrictionLevel;
  count: number;
  reasons: string[];
  /** Quota di lettori persi (solo aggregato). */
  lostShare?: number;
  /** Lettori considerati (solo aggregato): i trattini sono i lettori persi. */
  readers?: number;
}

const LABEL: Record<FrictionLevel, string> = { verde: "scorre", giallo: "attenzione", rosso: "si perde" };

/** Generatore deterministico: gli stessi dati danno sempre la stessa tavola. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function SnowMap({ items, title = "Dove il testo si perde" }: { items: MapItem[]; title?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const selected = items.find((i) => i.clauseId === open);
  const W = 640, PAD = 28, GAP = 30;
  const H = PAD * 2 + Math.max(1, items.length - 1) * GAP + 20;

  const marks = useMemo(() => {
    const out: { x: number; y: number; a: number; id: string }[] = [];
    items.forEach((it, i) => {
      const y = PAD + 10 + i * GAP;
      const n = it.readers !== undefined ? Math.round((it.lostShare ?? 0) * it.readers) * 2 : it.count * 7;
      const r = rng(i * 7919 + n * 131 + 17);
      for (let k = 0; k < n; k++) {
        // Addensamento attorno alla riga: distribuzione stretta in verticale, larga in orizzontale attorno al centro-sinistra.
        // Addensamento gaussiano: molti trattini vicino alla riga, pochi lontano.
        const g = () => (r() + r() + r() - 1.5) / 1.5;
        const cx = W * 0.45 + g() * W * (0.12 + 0.06 * Math.min(1, n / 20));
        const cy = y + g() * 9;
        out.push({ x: cx, y: cy, a: (r() - 0.5) * 70, id: it.clauseId });
      }
    });
    return out;
  }, [items]);

  const worst = [...items].sort((a, b) => ({ rosso: 2, giallo: 1, verde: 0 }[b.level] - { rosso: 2, giallo: 1, verde: 0 }[a.level]) || b.count - a.count)[0];
  const caption = !worst
    ? ""
    : worst.level === "verde"
      ? "I trattini sono radi e sparsi: nessuna riga li raccoglie. Il testo scorre."
      : `I trattini si addensano attorno alla riga ${worst.index}${worst.heading ? `, «${worst.heading}»` : ""}: è lì che il documento perde chi legge. ${
          items.filter((i) => i.level !== "verde").length > 1 ? "Altre righe li attirano meno." : "Le altre righe restano pulite."
        }`;

  return (
    <section className="tavola" aria-label={title}>
      <header className="tavola-head">
        <span className="tavola-title">{title}</span>
        <span className="legend-inline">
          <span className="friction verde">scorre</span>
          <span className="friction giallo">attenzione</span>
          <span className="friction rosso">si perde</span>
        </span>
      </header>
      <svg className="snowmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mappa della frizione: una riga per clausola, trattini dove chi legge si perde">
        <rect x={PAD - 16} y={8} width={W - PAD * 2 + 32} height={H - 16} className="snow-page" />
        {items.map((it, i) => {
          const y = PAD + 10 + i * GAP;
          const isOpen = open === it.clauseId;
          return (
            <g key={it.clauseId} className={`snow-row ${it.level} ${isOpen ? "open" : ""}`} onClick={() => setOpen(isOpen ? null : it.clauseId)} style={{ cursor: "pointer" }}>
              <rect x={PAD - 16} y={y - GAP / 2} width={W - PAD * 2 + 32} height={GAP} className="snow-hit" />
              <text x={PAD - 4} y={y + 4} className="snow-num" textAnchor="end">{it.index}</text>
              <line x1={PAD + 8} x2={W - PAD - 8} y1={y} y2={y} className="snow-line" style={{ animationDelay: `${i * 60}ms` }} />
              <text x={W - PAD - 6} y={y - 6} className="snow-label" textAnchor="end">{LABEL[it.level]}{it.lostShare !== undefined ? ` · ${Math.round(it.lostShare * 100)}%` : ""}</text>
            </g>
          );
        })}
        {marks.map((m, k) => (
          <line
            key={k}
            x1={m.x - 3} x2={m.x + 3} y1={m.y} y2={m.y}
            transform={`rotate(${m.a} ${m.x} ${m.y})`}
            className={`snow-mark ${open && open !== m.id ? "dim" : ""}`}
            style={{ animationDelay: `${300 + k * 18}ms` }}
          />
        ))}
      </svg>
      <p className="tavola-caption">«{caption}»</p>
      {selected && (
        <div className={`tile-detail ${selected.level}`}>
          <strong>
            {selected.index}. {selected.heading ?? "clausola"} · {LABEL[selected.level]}
          </strong>
          {selected.reasons.length ? (
            <ul>{selected.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          ) : (
            <p>Nessun indizio di frizione: tempo, testo, verifica e prova non convergono.</p>
          )}
        </div>
      )}
      <p className="plain"><span className="plain-label">Che cosa mostra, in parole semplici.</span> Ogni riga è una clausola, nell'ordine di lettura. I trattini sono gli indizi raccolti: tempo, corpo, testo, verifica, prova. Dove si addensano, il testo perde chi legge. Il colore riassume la convergenza degli indizi e non giudica mai la persona: fa la diagnosi al documento.</p>
    </section>
  );
}
