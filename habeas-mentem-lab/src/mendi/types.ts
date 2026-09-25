// Tipi condivisi del livello Mendi.

/** Un campione del flusso dati (caratteristica Frame, ~25 Hz). */
export interface Frame {
  /** Orario di ricezione in ms (epoch). La fascia non invia timestamp. */
  timestamp: number;
  accX: number; accY: number; accZ: number;
  angX: number; angY: number; angZ: number;
  temperature: number;
  /** Canale sinistro: infrarosso, rosso, luce ambiente. */
  irLeft: number; redLeft: number; ambLeft: number;
  /** Canale destro. */
  irRight: number; redRight: number; ambRight: number;
  /** Canale centrale / pulsossimetria. */
  irPulse: number; redPulse: number; ambPulse: number;
}

export interface AdcReading {
  timestamp: number;
  voltageMv: number;
  charging: boolean;
  usb: boolean;
}

export interface DiagnosticsReading {
  timestamp: number;
  adc: AdcReading | null;
  imuOk: boolean;
  sensorOk: boolean;
}

export interface CalibrationReading {
  timestamp: number;
  offsetLeft: number;
  offsetRight: number;
  offsetPulse: number;
  autoCalibration: boolean;
  lowPowerMode: boolean;
}

export interface DeviceInfo {
  name: string;
  id: string;
  firmwareVersion: string | null;
  hardwareVersion: string | null;
  simulated: boolean;
}

export type MendiEvent =
  | { type: "connected"; device: DeviceInfo }
  | { type: "frame"; frame: Frame }
  | { type: "battery"; reading: AdcReading }
  | { type: "diagnostics"; reading: DiagnosticsReading }
  | { type: "calibration"; reading: CalibrationReading }
  | { type: "error"; message: string }
  | { type: "disconnected" };

export type MendiListener = (event: MendiEvent) => void;

/** Interfaccia comune a fascia reale e simulatore. */
export interface MendiSource {
  connect(): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  subscribe(listener: MendiListener): () => void;
  readonly connected: boolean;
}
