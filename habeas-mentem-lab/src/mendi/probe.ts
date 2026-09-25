// Sonda di accensione: prova, un passo alla volta, i modi plausibili per
// avviare il sensore ottico della fascia, e scrive nel log che cosa cambia.
//
// Che cosa sappiamo (firmware 1.0.4, hardware r2.2a): IMU, temperatura e
// batteria arrivano; i canali ottici valgono zero e il Frame non viene
// notificato. Il registro del sensore ha indirizzo a 8 bit e dato a 24 bit,
// la firma di un front-end ottico della famiglia TI AFE44xx. I passi qui
// sotto seguono quell'ipotesi; ogni scrittura è volatile: spegnere e
// riaccendere la fascia riporta tutto com'era.

import type { WebBluetoothMendi } from "./webbluetooth";
import { describeOptics, hasOptics } from "./webbluetooth";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Registri da leggere per riconoscere il chip (AFE4404: 0x23 controllo, 0x22 correnti LED, 0x1E timer). */
const REGISTERS_TO_READ = [0x00, 0x01, 0x1e, 0x22, 0x23, 0x29, 0x2a, 0x2e, 0x31, 0xff];

interface Step {
  title: string;
  run: (dev: WebBluetoothMendi) => Promise<void>;
}

const STEPS: Step[] = [
  {
    title: "calibrazione con correnti LED esplicite (20 mA) e autocalibrazione",
    run: (d) => d.writeCalibration(20, 20, 20, true, false).then(() => undefined),
  },
  {
    title: "calibrazione con correnti esplicite, senza autocalibrazione",
    run: (d) => d.writeCalibration(20, 20, 20, false, false).then(() => undefined),
  },
  {
    title: "AFE4404: accensione del front-end (registro 0x23 = 0x124218)",
    run: (d) => d.writeRegister(0x23, 0x124218).then(() => undefined),
  },
  {
    title: "AFE4404: timer interno acceso (registro 0x1E = 0x000103)",
    run: (d) => d.writeRegister(0x1e, 0x000103).then(() => undefined),
  },
  {
    title: "AFE4404: correnti LED (registro 0x22 = 0x030C30, ~38 mA)",
    run: (d) => d.writeRegister(0x22, 0x030c30).then(() => undefined),
  },
  {
    title: "Sensor(read=true) dopo la configurazione",
    run: (d) => d.enableSensor().then(() => undefined),
  },
];

/** Esegue la sonda e ritorna true se, alla fine, il sensore ottico risponde. */
export async function runProbe(dev: WebBluetoothMendi, log: (line: string) => void): Promise<boolean> {
  log("── Sonda di accensione: guarda i LED sulla fronte durante la prova ──");
  const before = await dev.readFrameOnce();
  if (before) log(`Prima: ${describeOptics(before)}`);

  log("Leggo i registri del sensore ottico…");
  for (const addr of REGISTERS_TO_READ) {
    if (!dev.connected) return false;
    const r = await dev.readRegister(addr);
    log(r ? `  registro 0x${addr.toString(16).padStart(2, "0")} = 0x${r.data.toString(16).padStart(6, "0")}` : `  registro 0x${addr.toString(16).padStart(2, "0")}: nessuna risposta`);
  }

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
    await wait(2500);
    const f = await dev.readFrameOnce();
    const gained = dev.notifiedCount - notifiedBefore;
    if (f) log(`  dopo: ${describeOptics(f)} · notifiche in 2,5 s: ${gained}`);
    if (gained > 0) {
      log(`Il flusso per notifica è partito al passo ${i + 1}.`);
      return true;
    }
    if (f && hasOptics(f)) {
      log(`Il sensore ottico risponde al passo ${i + 1} (senza notifiche): passo alla lettura in polling.`);
      dev.startPolling();
      return true;
    }
  }
  for (const addr of [0x1e, 0x22, 0x23]) {
    const r = await dev.readRegister(addr);
    log(r ? `  rilettura 0x${addr.toString(16)} = 0x${r.data.toString(16).padStart(6, "0")}` : `  rilettura 0x${addr.toString(16)}: nessuna risposta`);
  }
  log("Sonda finita: il sensore ottico non si è acceso. Copia questo log e mandamelo.");
  return false;
}
