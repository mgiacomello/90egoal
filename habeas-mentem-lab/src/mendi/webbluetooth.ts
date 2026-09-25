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

  async connect(): Promise<DeviceInfo> {
    if (!isWebBluetoothAvailable()) {
      throw new Error("Web Bluetooth non disponibile: usa Chrome o Edge su desktop o Android.");
    }
    // La finestra di scelta del browser mostra solo i dispositivi che
    // corrispondono ai filtri: nome "Mendi…" oppure servizio proprietario.
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: MENDI_NAME_PREFIX }, { services: [MENDI_SERVICE_UUID] }],
      optionalServices: [MENDI_SERVICE_UUID, DEVICE_INFORMATION_SERVICE],
    });
    this.device.addEventListener("gattserverdisconnected", () => {
      this.server = null;
      this.calibration = null;
      this.emit({ type: "disconnected" });
    });

    const server = await this.device.gatt!.connect();
    this.server = server;

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

    const frame = await service.getCharacteristic(FRAME_CHARACTERISTIC);
    frame.addEventListener("characteristicvaluechanged", (ev) => {
      const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      const decoded = decodeFrame(toBytes(value));
      if (decoded) this.emit({ type: "frame", frame: decoded });
    });
    await frame.startNotifications();

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
