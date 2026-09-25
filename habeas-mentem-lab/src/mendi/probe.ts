// Sonda di accensione per il front-end ottico della fascia (TI AFE4404).
//
// Che cosa sappiamo (firmware 1.0.4, hardware r2.2a): IMU, temperatura e
// batteria arrivano; i canali ottici valgono zero e il Frame non viene
// notificato. I registri letti (0x23 = 0x020200 con oscillatore acceso,
// 0x31 = 0x20, 0x2A = offset DAC) sono quelli di un AFE4404 con le
// temporizzazioni programmate ma il timer (0x1E) spento. La sonda prima
// fotografa tutti i registri, poi accende il timer in varianti diverse e
// misura dopo ognuna. Ogni scrittura è volatile: spegnere e riaccendere la
// fascia riporta tutto com'era.

import type { WebBluetoothMendi } from "./webbluetooth";
import { AFE_CONTROL1, describeOptics, hasOptics } from "./webbluetooth";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const h6 = (n: number) => `0x${n.toString(16).padStart(6, "0")}`;
const h2 = (n: number) => `0x${n.toString(16).padStart(2, "0")}`;

/** Registri dei risultati ADC dell'AFE4404: LED2, ALED2, LED1, ALED1, poi LED2-ALED2, LED1-ALED1, LED3 (0x3A-0x3F). */
const ADC_REGISTERS = [0x2c, 0x2d, 0x2e, 0x2f, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f];

interface Step {
  title: string;
  run: (dev: WebBluetoothMendi) => Promise<void>;
}

const STEPS: Step[] = [
  {
    title: "timer AFE acceso, senza medie (0x1E = 0x000100)",
    run: (d) => d.startAfeTimer(0).then(() => undefined),
  },
  {
    title: "timer AFE acceso con 4 medie, come nel riferimento TI (0x1E = 0x000103)",
    run: (d) => d.startAfeTimer(3).then(() => undefined),
  },
  {
    title: "correnti LED moderate (0x22 = 0x030C30, ~38 mA per LED) con timer acceso",
    run: async (d) => {
      await d.writeRegister(0x22, 0x030c30);
      await d.startAfeTimer(3);
    },
  },
  {
    title: "controllo AFE del riferimento TI (0x23 = 0x124218) con timer acceso",
    run: async (d) => {
      await d.writeRegister(0x23, 0x124218);
      await d.startAfeTimer(3);
    },
  },
  {
    title: "calibrazione con correnti LED esplicite (20 mA) e timer acceso",
    run: async (d) => {
      await d.writeCalibration(20, 20, 20, true, false);
      await d.startAfeTimer(3);
    },
  },
  {
    title: "Sensor(read=true) dopo tutto",
    run: (d) => d.enableSensor().then(() => undefined),
  },
];

async function dumpRegisters(dev: WebBluetoothMendi, from: number, to: number, log: (l: string) => void): Promise<Map<number, number>> {
  const values = new Map<number, number>();
  let line: string[] = [];
  for (let addr = from; addr <= to; addr++) {
    if (!dev.connected) break;
    const r = await dev.readRegister(addr, 400);
    if (r) values.set(addr, r.data);
    line.push(`${h2(addr)}=${r ? h6(r.data) : "------"}`);
    if (line.length === 4) {
      log("  " + line.join("  "));
      line = [];
    }
  }
  if (line.length) log("  " + line.join("  "));
  return values;
}

async function readAdc(dev: WebBluetoothMendi, log: (l: string) => void): Promise<boolean> {
  const parts: string[] = [];
  let nonZero = false;
  for (const addr of ADC_REGISTERS) {
    const r = await dev.readRegister(addr, 400);
    if (r && r.data !== 0) nonZero = true;
    parts.push(`${h2(addr)}=${r ? h6(r.data) : "------"}`);
  }
  log("  ADC: " + parts.join(" "));
  return nonZero;
}

/** Esegue la sonda e ritorna true se, alla fine, il sensore ottico risponde. */
export async function runProbe(dev: WebBluetoothMendi, log: (line: string) => void): Promise<boolean> {
  dev.probing = true;
  try {
    log("── Sonda di accensione: guarda i LED sulla fronte durante la prova ──");
    const before = await dev.readFrameOnce();
    if (before) log(`Prima: ${describeOptics(before)}`);

    log("Fotografia dei registri dell'AFE (0x00-0x3F)…");
    const regs = await dumpRegisters(dev, 0x00, 0x3f, log);
    const timing = [...regs.entries()].filter(([a, v]) => a >= 0x01 && a <= 0x1d && v !== 0).length;
    log(`Registri di temporizzazione non nulli: ${timing}/29 · 0x1E (timer) = ${regs.has(AFE_CONTROL1) ? h6(regs.get(AFE_CONTROL1)!) : "?"} · 0x23 = ${regs.has(0x23) ? h6(regs.get(0x23)!) : "?"}`);

    for (const [i, step] of STEPS.entries()) {
      if (!dev.connected) {
        log("La fascia si è scollegata durante la sonda.");
        return false;
      }
      log(`Passo ${i + 1}/${STEPS.length}: ${step.title}`);
      const notifiedBefore = dev.notifiedCount;
      try {
        await step.run(dev);
      } catch (e) {
        log(`  errore: ${e instanceof Error ? e.message : String(e)}`);
      }
      await wait(2000);
      const adc = await readAdc(dev, log);
      const f = await dev.readFrameOnce();
      const gained = dev.notifiedCount - notifiedBefore;
      if (f) log(`  dopo: ${describeOptics(f)} · notifiche in 2 s: ${gained}`);
      if (gained > 0) {
        log(`Il flusso per notifica è partito al passo ${i + 1}.`);
        return true;
      }
      if (f && hasOptics(f)) {
        log(`Il sensore ottico risponde al passo ${i + 1} (senza notifiche): passo alla lettura in polling.`);
        dev.startPolling();
        return true;
      }
      if (adc) log("  L'ADC dell'AFE converte, ma il firmware non riporta i valori nel Frame.");
    }
    log("Sonda finita: il sensore ottico non si è acceso. Copia questo log e mandamelo.");
    return false;
  } finally {
    dev.probing = false;
  }
}
