// Fascia Mendi simulata: permette di provare l'intero flusso senza hardware.
//
// Genera frame protobuf realistici (li codifica e li decodifica davvero,
// così il percorso testato è lo stesso della fascia reale). Il segnale è
// un rumore lento con una deriva casuale: NON simula il carico cognitivo,
// serve solo a esercitare l'interfaccia e l'esportazione.

import { MENDI_FRAME_RATE_HZ } from "./protocol";
import { decodeFrame, encodeFrame } from "./protobuf";
import type { DeviceInfo, MendiListener, MendiSource } from "./types";

export class SimulatedMendi implements MendiSource {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<MendiListener>();
  private t = 0;
  private drift = { left: 0, right: 0 };
  connected = false;

  subscribe(listener: MendiListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit: MendiListener = (event) => {
    for (const l of this.listeners) l(event);
  };

  async connect(): Promise<DeviceInfo> {
    const info: DeviceInfo = {
      name: "Mendi-SIM",
      id: "simulated",
      firmwareVersion: "SIM-1.0.0",
      hardwareVersion: null,
      simulated: true,
    };
    this.connected = true;
    this.emit({ type: "connected", device: info });
    this.emit({ type: "battery", reading: { timestamp: Date.now(), voltageMv: 3900, charging: false, usb: false } });
    this.timer = setInterval(() => this.tick(), 1000 / MENDI_FRAME_RATE_HZ);
    return info;
  }

  private tick(): void {
    this.t += 1 / MENDI_FRAME_RATE_HZ;
    // Deriva lenta (random walk smorzato) per canale, più battito e respiro.
    this.drift.left = this.drift.left * 0.995 + (Math.random() - 0.5) * 40;
    this.drift.right = this.drift.right * 0.995 + (Math.random() - 0.5) * 40;
    const pulse = Math.sin(2 * Math.PI * 1.1 * this.t) * 120; // ~66 bpm
    const breath = Math.sin(2 * Math.PI * 0.25 * this.t) * 60; // ~15 atti/min
    const noise = () => (Math.random() - 0.5) * 30;

    const bytes = encodeFrame({
      accX: Math.round(noise()), accY: Math.round(noise()), accZ: 16384 + Math.round(noise()),
      angX: Math.round(noise()), angY: Math.round(noise()), angZ: Math.round(noise()),
      temperature: 33.5 + Math.sin(this.t / 60) * 0.2,
      irLeft: Math.round(52000 + this.drift.left + pulse + breath + noise()),
      redLeft: Math.round(31000 + this.drift.left * 0.6 + pulse * 0.5 + noise()),
      ambLeft: Math.round(800 + noise()),
      irRight: Math.round(50500 + this.drift.right + pulse + breath + noise()),
      redRight: Math.round(30200 + this.drift.right * 0.6 + pulse * 0.5 + noise()),
      ambRight: Math.round(780 + noise()),
      irPulse: Math.round(60000 + pulse * 3 + noise()),
      redPulse: Math.round(35000 + pulse * 1.5 + noise()),
      ambPulse: Math.round(900 + noise()),
    });
    const frame = decodeFrame(bytes);
    if (frame) this.emit({ type: "frame", frame });
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.connected = false;
    this.emit({ type: "disconnected" });
  }
}
