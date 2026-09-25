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
  MENDI_SERVICE_UUID,
} from "./protocol";
import { decodeAdc, decodeCalibration, decodeDiagnostics, decodeFrame, encodeCalibration } from "./protobuf";
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
  private calibration: BluetoothRemoteGATTCharacteristic | null = null;
  private listeners = new Set<MendiListener>();

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
      this.server = null;
      this.calibration = null;
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
    } catch {
      // Il servizio Device Information è facoltativo.
    }

    const service = await server.getPrimaryService(MENDI_SERVICE_UUID);
    log("Servizio Mendi trovato. Attivo le notifiche del flusso dati (0xABB1)…");

    const frame = await service.getCharacteristic(FRAME_CHARACTERISTIC);
    frame.addEventListener("characteristicvaluechanged", (ev) => {
      const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      const decoded = decodeFrame(toBytes(value));
      if (decoded) this.emit({ type: "frame", frame: decoded });
    });
    await frame.startNotifications();
    log("Notifiche attive: i campioni arrivano.");

    try {
      const adc = await service.getCharacteristic(ADC_CHARACTERISTIC);
      adc.addEventListener("characteristicvaluechanged", (ev) => {
        const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        const decoded = decodeAdc(toBytes(value));
        if (decoded) this.emit({ type: "battery", reading: decoded });
      });
      await adc.startNotifications();
    } catch {
      // Batteria non disponibile: non è bloccante.
    }

    try {
      const cal = await service.getCharacteristic(CALIBRATION_CHARACTERISTIC);
      cal.addEventListener("characteristicvaluechanged", (ev) => {
        const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        const decoded = decodeCalibration(toBytes(value));
        if (decoded) this.emit({ type: "calibration", reading: decoded });
      });
      await cal.startNotifications();
      this.calibration = cal;
    } catch {
      this.calibration = null;
    }

    try {
      const diag = await service.getCharacteristic(DIAGNOSTICS_CHARACTERISTIC);
      const decoded = decodeDiagnostics(toBytes(await diag.readValue()));
      if (decoded) this.emit({ type: "diagnostics", reading: decoded });
    } catch {
      // Diagnostica facoltativa.
    }

    log(`Collegata: ${info.name}${info.firmwareVersion ? ` · firmware ${info.firmwareVersion}` : ""}`);
    this.emit({ type: "connected", device: info });
    return info;
  }

  /** Attiva l'autocalibrazione dei LED (equivale al comando `c` della CLI Rust). */
  async enableAutoCalibration(): Promise<void> {
    if (!this.calibration) return;
    const payload = encodeCalibration({
      offsetLeft: 0, offsetRight: 0, offsetPulse: 0, autoCalibration: true, lowPowerMode: false,
    });
    // Copia su un ArrayBuffer "puro": l'API BLE non accetta viste su SharedArrayBuffer.
    await this.calibration.writeValueWithResponse(payload.slice().buffer as ArrayBuffer);
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect();
    this.server = null;
  }
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
