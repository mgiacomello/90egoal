import { describe, expect, it } from "vitest";
import type { EffortSample } from "../src/mendi/signal";
import { fitHrfGlm, hrfKernel, HRF, MODEL_HZ } from "../src/session/hrf";

describe("risposta emodinamica canonica", () => {
  it("ha il picco intorno a 6 s, un sottoscatto negativo e torna a zero", () => {
    const k = hrfKernel();
    const peakIdx = k.indexOf(Math.max(...k));
    expect(peakIdx / MODEL_HZ).toBeGreaterThan(4.5);
    expect(peakIdx / MODEL_HZ).toBeLessThan(6.5);
    expect(Math.min(...k.slice(Math.round(10 * MODEL_HZ)))).toBeLessThan(0);
    expect(Math.abs(k[k.length - 1])).toBeLessThan(0.02);
    expect(k.length).toBe(HRF.lengthS * MODEL_HZ);
  });
});

describe("GLM con HRF", () => {
  it("attribuisce lo sforzo alla porzione giusta anche se la risposta arriva dopo, e non alla vicina", () => {
    // Quattro porzioni consecutive di 2 s. Solo la seconda produce sforzo.
    const t0 = 1_000_000;
    const intervals = [0, 1, 2, 3].map((i) => ({ id: `s${i + 1}`, from: t0 + i * 2000, to: t0 + (i + 1) * 2000 }));
    const k = hrfKernel();
    const effort: EffortSample[] = [];
    // Segnale sintetico: esposizione della seconda porzione ⊗ HRF, ampiezza 1, più rumore e una deriva.
    for (let ms = 0; ms < 40_000; ms += 40) {
      let v = 0;
      for (let s = 2000; s < 4000; s += 100) {
        const lag = (ms - s) / 1000;
        const j = Math.round(lag * MODEL_HZ);
        if (j >= 0 && j < k.length) v += k[j] / MODEL_HZ;
      }
      const noise = (Math.sin(ms / 173) + Math.cos(ms / 61)) * 0.05;
      effort.push({ timestamp: t0 + ms, left: 0, right: 0, effort: v + noise + ms / 400_000, motion: 0 });
    }
    const fit = fitHrfGlm(effort, intervals)!;
    expect(fit).not.toBeNull();
    const b = (id: string) => fit.beta.get(id)!;
    expect(b("s2")).toBeGreaterThan(0.5);
    expect(Math.abs(b("s1"))).toBeLessThan(b("s2") / 3);
    expect(Math.abs(b("s3"))).toBeLessThan(b("s2") / 3);
    expect(Math.abs(b("s4"))).toBeLessThan(b("s2") / 3);
    expect(fit.r2).toBeGreaterThan(0.8);
    expect(fit.se.get("s2")!).toBeLessThan(b("s2") / 2);
  });

  it("una finestra spostata di 4 s, invece, sbaglierebbe: il picco cade dentro la porzione successiva", () => {
    // Con porzioni da 2 s e picco a 6 s, la risposta della seconda porzione (2-4 s) culmina a 8-10 s: quarta e quinta porzione.
    const k = hrfKernel();
    const peakS = k.indexOf(Math.max(...k)) / MODEL_HZ;
    expect(2 + peakS).toBeGreaterThan(6);
  });

  it("senza campioni ritorna null", () => {
    expect(fitHrfGlm([], [{ id: "a", from: 0, to: 1000 }])).toBeNull();
  });
});
