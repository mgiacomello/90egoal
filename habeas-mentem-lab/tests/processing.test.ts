import { describe, expect, it } from "vitest";
import { BandPass, LowPass, PulseDetector, ShortChannelRegressor } from "../src/mendi/processing";

describe("filtri", () => {
  it("il passa-basso a 0,2 Hz lascia passare 0,05 Hz e attenua il battito a 1 Hz", () => {
    const fs = 25;
    const slow = new LowPass(0.2, fs);
    const fast = new LowPass(0.2, fs);
    let ampSlow = 0, ampFast = 0;
    for (let i = 0; i < fs * 120; i++) {
      const t = i / fs;
      const ys = slow.push(Math.sin(2 * Math.PI * 0.05 * t));
      const yf = fast.push(Math.sin(2 * Math.PI * 1.0 * t));
      if (t > 60) { ampSlow = Math.max(ampSlow, Math.abs(ys)); ampFast = Math.max(ampFast, Math.abs(yf)); }
    }
    expect(ampSlow).toBeGreaterThan(0.9);
    expect(ampFast).toBeLessThan(0.1);
  });

  it("il passa-banda toglie una deriva costante", () => {
    const bp = new BandPass(0.01, 0.2, 25);
    let last = 0;
    for (let i = 0; i < 25 * 600; i++) last = bp.push(5);
    expect(Math.abs(last)).toBeLessThan(0.05);
  });
});

describe("regressione del canale corto", () => {
  it("toglie dal canale lungo la parte spiegata dal canale corto", () => {
    const r = new ShortChannelRegressor(1500);
    let out = { clean: 0, beta: 0 };
    for (let i = 0; i < 1500; i++) {
      const t = i / 25;
      const short = Math.sin(2 * Math.PI * 0.1 * t);
      const brain = 0.3 * Math.sin(2 * Math.PI * 0.03 * t);
      out = r.push(brain + 0.8 * short, short);
    }
    expect(out.beta).toBeGreaterThan(0.7);
    expect(out.beta).toBeLessThan(0.9);
  });
});

describe("battito dal canale pulse", () => {
  it("stima 72 bpm da un'onda sintetica con rumore e deriva", () => {
    const fs = 25;
    const d = new PulseDetector(fs);
    let reading = null as ReturnType<PulseDetector["reading"]> | null;
    for (let i = 0; i < fs * 40; i++) {
      const t = i / fs;
      const phase = (t * 1.2) % 1; // 72 bpm
      const wave = Math.exp(-((phase - 0.2) ** 2) / 0.02) * 400 + Math.exp(-((phase - 0.55) ** 2) / 0.01) * 120; // sistole e onda dicrota
      const ir = 1_000_000 - wave + 2000 * Math.sin(2 * Math.PI * 0.25 * t) + (Math.random() - 0.5) * 40 + t * 30;
      const r = d.push(ir, i * (1000 / fs));
      if (r) reading = r;
    }
    expect(reading).not.toBeNull();
    expect(reading!.bpm).toBeGreaterThanOrEqual(69);
    expect(reading!.bpm).toBeLessThanOrEqual(75);
    expect(reading!.quality).toBeGreaterThan(0.8);
  });
});
