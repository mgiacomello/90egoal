// La mappa della frizione come striscia: una tessera per clausola, nell'ordine
// di lettura. Colore di stato con etichetta (mai colore da solo); al clic
// la tessera racconta le ragioni.

import { useState } from "react";
import type { FrictionLevel } from "../session/friction";

export interface StripItem {
  clauseId: string;
  index: number;
  heading: string | null;
  level: FrictionLevel;
  count: number;
  reasons: string[];
  /** Quota di lettori persi (solo aggregato). */
  lostShare?: number;
}

const LABEL: Record<FrictionLevel, string> = { verde: "scorre", giallo: "attenzione", rosso: "si perde" };

export function FrictionStrip({ items, title = "Dove il testo si perde" }: { items: StripItem[]; title?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const selected = items.find((i) => i.clauseId === open);
  return (
    <section className="strip-wrap" aria-label={title}>
      <div className="strip-head">
        <h2>{title}</h2>
        <span className="legend-inline">
          <span className="friction verde">scorre</span>
          <span className="friction giallo">attenzione</span>
          <span className="friction rosso">si perde</span>
        </span>
      </div>
      <div className="strip" role="list">
        {items.map((it) => (
          <button
            key={it.clauseId}
            role="listitem"
            className={`tile ${it.level} ${open === it.clauseId ? "open" : ""}`}
            onClick={() => setOpen(open === it.clauseId ? null : it.clauseId)}
            title={`${it.index}. ${it.heading ?? ""} — ${LABEL[it.level]}`}
            aria-label={`Clausola ${it.index}: ${LABEL[it.level]}`}
          >
            <span className="tile-num">{it.index}</span>
            {it.lostShare !== undefined && <span className="tile-sub">{Math.round(it.lostShare * 100)}%</span>}
          </button>
        ))}
      </div>
      {selected && (
        <div className={`tile-detail ${selected.level}`}>
          <strong>
            {selected.index}. {selected.heading ?? "clausola"} · {LABEL[selected.level]}
          </strong>
          {selected.reasons.length ? (
            <ul>
              {selected.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p>Nessun indizio di frizione: tempo, testo, verifica e prova non convergono.</p>
          )}
        </div>
      )}
    </section>
  );
}
