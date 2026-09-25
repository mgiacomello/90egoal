// Client Web Bluetooth per la fascia Mendi.
//
// Funziona su Chrome ed Edge (desktop e Android) in contesto sicuro
// (https o localhost). Safari e Firefox non supportano Web Bluetooth.

import {
  ADC_CHARACTERISTIC,
  CALIBRATION_CHARACTERISTIC,
  DIAGNOSTICS_CHARACTERISTIC,
  FRAME_CHARACTERISTIC,
  MENDI_NAME_PREFIX,
  SENSOR_CHARACTERISTIC,
  MENDI_SERVICE_UUID,
} from "./protocol";
import { decodeAdc, decodeCalibration, decodeDiagnostics, decodeFrame, decodeSensor, encodeCalibration, encodeSensor } from "./protobuf";
import type { DeviceInfo, MendiListener, MendiSource } from "./types";

const DEVICE_INFORMATION_SERVICE = "device_information";
const FIRMWARE_REVISION = "firmware_revision_string";
const HARDWARE_REVISION = "hardware_revision_string";

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export interface BluetoothDiagnosis {
  /** navigator.bluetooth esiste (Chrome, Edge, Opera; non Safari né Firefox). */
  api: boolean;
  /** https o localhost: senza, il browser non espone il Bluetooth. */
  secureContext: boolean;
  /** Dentro un riquadro (anteprima, artifact): il Bluetooth è quasi sempre bloccato. */
  inIframe: boolean;
  /** L'adattatore Bluetooth del computer è acceso (se il browser lo sa dire). */
  adapterAvailable: boolean | null;
  userAgent: string;
  /** La frase da mostrare: che cosa blocca, e che cosa fare. */
  verdict: string;
}

/** Che cosa impedisce il collegamento, prima ancora di provare. */
export async function diagnoseBluetooth(): Promise<BluetoothDiagnosis> {
  const api = isWebBluetoothAvailable();
  const secureContext = typeof window !== "undefined" && window.isSecureContext;
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  let adapterAvailable: boolean | null = null;
  if (api && typeof navigator.bluetooth.getAvailability === "function") {
    try {
      adapterAvailable = await navigator.bluetooth.getAvailability();
    } catch {
      adapterAvailable = null;
    }
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let verdict: string;
  if (inIframe) {
    verdict = "Questa pagina è dentro un riquadro (anteprima): il Bluetooth è bloccato. Apri l'app in una scheda propria del browser, su https o localhost.";
  } else if (!secureContext) {
    verdict = "La pagina non è su https né su localhost: il browser non espone il Bluetooth.";
  } else if (!api) {
    verdict = /iPhone|iPad/.test(ua)
      ? "Su iPhone e iPad Safari e Chrome non hanno il Bluetooth dal browser. Due strade: apri questo stesso indirizzo nell'app Bluefy (App Store, gratuita), che lo implementa; oppure usa Chrome su Mac, Windows o Android."
      : /Android/.test(ua)
        ? "Questo browser non ha il Web Bluetooth: su Android apri l'indirizzo in Chrome."
        : "Questo browser non ha il Web Bluetooth: usa Chrome o Edge.";
  } else if (adapterAvailable === false) {
    verdict = "Il Bluetooth del computer è spento o non concesso a Chrome: accendilo e, su Mac, controlla Impostazioni → Privacy e sicurezza → Bluetooth → Chrome.";
  } else {
    verdict = "Tutto pronto: il tasto apre la finestra di scelta del browser. Se la fascia non compare: accendila, chiudi l'app Mendi sul telefono (tiene occupata la connessione), avvicinala.";
  }
  return { api, secureContext, inIframe, adapterAvailable, userAgent: ua, verdict };
}

export interface ConnectOptions {
  /** Mostra tutti i dispositivi invece di filtrare per nome/servizio. */
  acceptAllDevices?: boolean;
  /** Riceve ogni passaggio, per capire dove si ferma. */
  log?: (line: string) => void;
}

/** Traduce gli errori del browser in una frase che dice che cosa fare. */
export function explainBluetoothError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  const msg = e instanceof Error ? e.message : String(e);
  switch (name) {
    case "NotFoundError":
      return /cancel/i.test(msg)
        ? "Nessun dispositivo scelto."
        : "La fascia non è stata trovata. Accendila, chiudi l'app Mendi sul telefono, avvicinala, e prova con «mostra tutti i dispositivi».";
    case "SecurityError":
      return "Il browser blocca il Bluetooth in questa pagina (riquadro o permesso negato). Apri l'app in una scheda propria, su https o localhost.";
    case "NetworkError":
      return "Connessione fallita: la fascia è probabilmente collegata a un altro dispositivo (l'app Mendi). Chiudi l'app, spegni e riaccendi la fascia, riprova.";
    case "NotSupportedError":
      return "La fascia non espone il servizio atteso: potrebbe avere un firmware diverso. Copia il log e mandamelo.";
    case "InvalidStateError":
      return "Il Bluetooth del browser è in uno stato incoerente: ricarica la pagina e riprova.";
    default:
      return `${name ? name + ": " : ""}${msg}`;
  }
}

export class WebBluetoothMendi implements MendiSource {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private calibration: BluetoothRemoteGATTCharacteristic | null = null;
  private sensor: BluetoothRemoteGATTCharacteristic | null = null;
  private diagnostics: BluetoothRemoteGATTCharacteristic | null = null;
  private frameChar: BluetoothRemoteGATTCharacteristic | null = null;
  private frames = 0;
  private otherNotifications = 0;
  private listeners = new Set<MendiListener>();
  private log: (line: string) => void = () => undefined;
  private watchdog: ReturnType<typeof setTimeout>[] = [];

  get connected(): boolean {
    return this.server?.connected ?? false;
  }

  subscribe(listener: MendiListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit: MendiListener = (event) => {
    for (const l of this.listeners) l(event);
  };

  async connect(options: ConnectOptions = {}): Promise<DeviceInfo> {
    const log = options.log ?? (() => undefined);
    this.log = log;
    if (!isWebBluetoothAvailable()) {
      throw new Error("Web Bluetooth non disponibile: usa Chrome o Edge su desktop o Android.");
    }
    // La finestra di scelta del browser mostra solo i dispositivi che
    // corrispondono ai filtri: nome "Mendi…" oppure servizio proprietario.
    log(options.acceptAllDevices ? "Apro la finestra di scelta: tutti i dispositivi" : "Apro la finestra di scelta: filtro nome «Mendi» o servizio fc3eabb0");
    this.device = await navigator.bluetooth.requestDevice(
      options.acceptAllDevices
        ? { acceptAllDevices: true, optionalServices: [MENDI_SERVICE_UUID, DEVICE_INFORMATION_SERVICE] }
        : {
            filters: [{ namePrefix: MENDI_NAME_PREFIX }, { services: [MENDI_SERVICE_UUID] }],
            optionalServices: [MENDI_SERVICE_UUID, DEVICE_INFORMATION_SERVICE],
          },
    );
    log(`Dispositivo scelto: ${this.device.name ?? "(senza nome)"} · id ${this.device.id.slice(0, 8)}…`);
    this.device.addEventListener("gattserverdisconnected", () => {
      this.clearWatchdog();
      this.server = null;
      this.service = null;
      this.calibration = null;
      this.sensor = null;
      this.diagnostics = null;
      this.frameChar = null;
      log("Disconnessa.");
      this.emit({ type: "disconnected" });
    });

    log("Connessione GATT…");
    const server = await this.device.gatt!.connect();
    this.server = server;
    log("GATT connesso. Cerco i servizi…");

    const info: DeviceInfo = {
      name: this.device.name ?? "Mendi",
      id: this.device.id,
      firmwareVersion: null,
      hardwareVersion: null,
      simulated: false,
    };
    try {
      const dis = await server.getPrimaryService(DEVICE_INFORMATION_SERVICE);
      info.firmwareVersion = await readString(dis, FIRMWARE_REVISION);
      info.hardwareVersion = await readString(dis, HARDWARE_REVISION);
      log(`Firmware ${info.firmwareVersion ?? "?"} · hardware ${info.hardwareVersion ?? "?"}`);
    } catch {
      log("Servizio Device Information assente (non è bloccante).");
    }

    const service = await server.getPrimaryService(MENDI_SERVICE_UUID);
    this.service = service;
    log("Servizio Mendi trovato.");

    // Inventario: quali caratteristiche ci sono e che cosa permettono.
    // Serve a capire, dal log, con quale firmware abbiamo a che fare.
    try {
      const chars = await service.getCharacteristics();
      log(
        "Caratteristiche: " +
          chars
            .map((c) => {
              const short = c.uuid.slice(4, 8).toUpperCase();
              const p = c.properties;
              const flags = [p.read && "r", p.write && "w", p.writeWithoutResponse && "W", p.notify && "n", p.indicate && "i"].filter(Boolean).join("");
              return `${short}[${flags}]`;
            })
            .join(" "),
      );
    } catch (e) {
      log(`Elenco caratteristiche non disponibile: ${errText(e)}`);
    }

    // 1. Frame (0xABB1): il flusso dati. Prima le notifiche, poi i comandi che lo avviano.
    const frame = await service.getCharacteristic(FRAME_CHARACTERISTIC);
    this.frameChar = frame;
    frame.addEventListener("characteristicvaluechanged", (ev) => {
      const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      const bytes = toBytes(value);
      const decoded = decodeFrame(bytes);
      if (decoded) {
        this.frames++;
        if (this.frames === 1) {
          this.clearWatchdog();
          log(`Primo campione ricevuto (${bytes.length} byte: ${hex(bytes, 16)}…): la fascia trasmette.`);
          log(`IR sx ${decoded.irLeft} · IR dx ${decoded.irRight} · ambiente sx ${decoded.ambLeft} · temp ${decoded.temperature.toFixed(1)}°`);
        } else if (this.frames === 250) {
          log("250 campioni ricevuti (~10 s a 25 Hz). Flusso regolare.");
        }
        this.emit({ type: "frame", frame: decoded });
      } else if (this.frames === 0) {
        log(`Notifica su ABB1 non decodificabile (${bytes.length} byte: ${hex(bytes, 16)})`);
      }
    });
    await frame.startNotifications();
    log("Notifiche attive sul flusso dati (ABB1).");

    // 2. Le altre caratteristiche: ascoltiamo tutto, e scriviamo nel log
    //    i byte grezzi delle prime risposte, così si vede se la fascia «parla».
    this.sensor = await this.listen(service, SENSOR_CHARACTERISTIC, "ABB2 Sensor", (bytes) => {
      const r = decodeSensor(bytes);
      if (r) log(`Sensor → read=${r.read} indirizzo 0x${r.address.toString(16)} dato 0x${r.data.toString(16)}`);
    });
    await this.listen(service, ADC_CHARACTERISTIC, "ABB4 Batteria", (bytes) => {
      const decoded = decodeAdc(bytes);
      if (decoded) this.emit({ type: "battery", reading: decoded });
    });
    this.calibration = await this.listen(service, CALIBRATION_CHARACTERISTIC, "ABB6 Calibrazione", (bytes) => {
      const decoded = decodeCalibration(bytes);
      if (decoded) {
        log(`Calibrazione → offset L ${decoded.offsetLeft.toFixed(1)} R ${decoded.offsetRight.toFixed(1)} P ${decoded.offsetPulse.toFixed(1)} · auto ${decoded.autoCalibration ? "sì" : "no"} · risparmio ${decoded.lowPowerMode ? "sì" : "no"}`);
        this.emit({ type: "calibration", reading: decoded });
      }
    });
    try {
      this.diagnostics = await service.getCharacteristic(DIAGNOSTICS_CHARACTERISTIC);
      await this.readDiagnostics();
    } catch (e) {
      log(`Diagnostica non disponibile: ${errText(e)}`);
    }

    // 3. Accensione. È la sequenza della CLI Rust `mendi` (tasti c, e) e
    //    dell'app Mendi: autocalibrazione dei LED, poi Sensor(read=true).
    await this.wakeUp();

    // 4. Se in pochi secondi non arriva nulla, riproviamo da soli, in modo
    //    diverso: il log dice che cosa abbiamo tentato.
    this.armWatchdog();

    log(`Collegata: ${info.name}${info.firmwareVersion ? ` · firmware ${info.firmwareVersion}` : ""}`);
    this.emit({ type: "connected", device: info });
    return info;
  }

  private async listen(
    service: BluetoothRemoteGATTService,
    uuid: string,
    label: string,
    onValue: (bytes: Uint8Array) => void,
  ): Promise<BluetoothRemoteGATTCharacteristic | null> {
    try {
      const c = await service.getCharacteristic(uuid);
      c.addEventListener("characteristicvaluechanged", (ev) => {
        const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        const bytes = toBytes(value);
        this.otherNotifications++;
        if (this.otherNotifications <= 12) this.log(`${label} ← ${bytes.length} byte: ${hex(bytes, 24)}`);
        onValue(bytes);
      });
      if (c.properties.notify || c.properties.indicate) await c.startNotifications();
      return c;
    } catch (e) {
      this.log(`${label}: ${errText(e)}`);
      return null;
    }
  }

  private async write(c: BluetoothRemoteGATTCharacteristic | null, payload: Uint8Array, label: string): Promise<boolean> {
    if (!c) {
      this.log(`${label}: caratteristica assente.`);
      return false;
    }
    // Copia su un ArrayBuffer "puro": l'API BLE non accetta viste su SharedArrayBuffer.
    const buf = payload.slice().buffer as ArrayBuffer;
    try {
      if (c.properties.write) await c.writeValueWithResponse(buf);
      else if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(buf);
      else await c.writeValue(buf);
      this.log(`${label} → ${hex(payload, 24) || "(vuoto)"} ok`);
      return true;
    } catch (e) {
      this.log(`${label} → ${hex(payload, 24) || "(vuoto)"} fallita: ${errText(e)}`);
      return false;
    }
  }

  /** Legge l'autodiagnosi (IMU ok, sensore ok, batteria) e la scrive nel log. */
  async readDiagnostics(): Promise<void> {
    if (!this.diagnostics) return;
    try {
      const bytes = toBytes(await this.diagnostics.readValue());
      const decoded = decodeDiagnostics(bytes);
      if (decoded) {
        this.log(
          `Diagnostica: IMU ${decoded.imuOk ? "ok" : "NO"} · sensore ottico ${decoded.sensorOk ? "ok" : "NO"}` +
            (decoded.adc ? ` · batteria ${decoded.adc.voltageMv} mV${decoded.adc.charging ? " in carica" : ""}` : "") +
            ` (${bytes.length} byte: ${hex(bytes, 16)})`,
        );
        this.emit({ type: "diagnostics", reading: decoded });
      } else this.log(`Diagnostica: ${bytes.length} byte non decodificabili (${hex(bytes, 16)})`);
    } catch (e) {
      this.log(`Lettura diagnostica fallita: ${errText(e)}`);
    }
  }

  /** Sequenza di accensione: autocalibrazione LED, poi sensore ottico. */
  async wakeUp(): Promise<void> {
    await this.enableAutoCalibration();
    await this.enableSensor();
  }

  /** Accende (o riaccende) il sensore ottico: Sensor(read=true) su 0xABB2. */
  async enableSensor(): Promise<boolean> {
    return this.write(this.sensor, encodeSensor(true), "Sensore ottico acceso (Sensor read=true)");
  }

  /** Attiva l'autocalibrazione dei LED (equivale al comando `c` della CLI Rust). */
  async enableAutoCalibration(): Promise<void> {
    const payload = encodeCalibration({
      offsetLeft: 0, offsetRight: 0, offsetPulse: 0, autoCalibration: true, lowPowerMode: false,
    });
    await this.write(this.calibration, payload, "Autocalibrazione LED (Calibration enable=true)");
  }

  /** Tentativi alternativi quando la fascia resta muta, uno per volta. */
  async nudge(step: number): Promise<void> {
    if (!this.service) return;
    if (this.frames > 0) return;
    if (step === 1) {
      this.log("Nessun campione dopo 4 s: riprovo Sensor(read=true).");
      await this.enableSensor();
    } else if (step === 2) {
      this.log("Ancora nulla dopo 8 s: leggo la diagnostica e rimando la calibrazione con risparmio energetico spento.");
      await this.readDiagnostics();
      await this.enableAutoCalibration();
      await this.enableSensor();
    } else if (step === 3) {
      this.log("Ancora nulla dopo 14 s: provo a leggere direttamente il Frame e a riattivare le notifiche.");
      if (this.frameChar?.properties.read) {
        try {
          const bytes = toBytes(await this.frameChar.readValue());
          this.log(`Lettura diretta ABB1: ${bytes.length} byte: ${hex(bytes, 24)}`);
          const f = decodeFrame(bytes);
          if (f && bytes.length > 0) this.emit({ type: "frame", frame: f });
        } catch (e) {
          this.log(`Lettura diretta ABB1 fallita: ${errText(e)}`);
        }
      }
      try {
        await this.frameChar?.stopNotifications();
        await this.frameChar?.startNotifications();
        this.log("Notifiche ABB1 riattivate.");
      } catch (e) {
        this.log(`Riattivazione notifiche fallita: ${errText(e)}`);
      }
      await this.enableSensor();
    } else {
      this.log(
        "La fascia è collegata ma non trasmette. Prova: spegni e riaccendi la fascia (tasto laterale, fino alla vibrazione), " +
          "assicurati che l'app Mendi sia chiusa, poi «scollega» e ricollega. Se i LED restano spenti, copia questo log e mandamelo.",
      );
    }
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    const plan: [number, number][] = [[4000, 1], [8000, 2], [14000, 3], [20000, 4]];
    for (const [ms, step] of plan) {
      this.watchdog.push(setTimeout(() => void this.nudge(step).catch(() => undefined), ms));
    }
  }

  private clearWatchdog(): void {
    for (const t of this.watchdog) clearTimeout(t);
    this.watchdog = [];
  }

  /** Campioni ricevuti dall'inizio del collegamento. */
  get frameCount(): number {
    return this.frames;
  }

  async disconnect(): Promise<void> {
    this.clearWatchdog();
    try {
      if (this.sensor) await this.sensor.writeValueWithResponse(encodeSensor(false).slice().buffer as ArrayBuffer);
    } catch {
      // La fascia potrebbe essere già scollegata.
    }
    this.device?.gatt?.disconnect();
    this.server = null;
    this.service = null;
    this.sensor = null;
    this.calibration = null;
    this.diagnostics = null;
    this.frameChar = null;
  }
}

function hex(bytes: Uint8Array, max: number): string {
  const head = Array.from(bytes.subarray(0, max), (b) => b.toString(16).padStart(2, "0")).join(" ");
  return bytes.length > max ? `${head} …` : head;
}

function errText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function toBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

async function readString(
  service: BluetoothRemoteGATTService,
  characteristic: string,
): Promise<string | null> {
  try {
    const c = await service.getCharacteristic(characteristic);
    const v = await c.readValue();
    return new TextDecoder().decode(toBytes(v));
  } catch {
    return null;
  }
}
