// Protocollo BLE della fascia Mendi (wire protocol V4).
//
// La fascia espone un servizio GATT proprietario con sei caratteristiche,
// ognuna delle quali trasporta messaggi codificati in protobuf.
// Base UUID del vendor: fc3eXXXX-c6c4-49e6-922a-6e551c455af5.
// Fonte: ricostruzione open source (crate Rust `mendi`, licenza MIT).

export function mendiUuid(short: number): string {
  return `fc3e${short.toString(16).padStart(4, "0")}-c6c4-49e6-922a-6e551c455af5`;
}

export const MENDI_SERVICE_UUID = mendiUuid(0xabb0);

/** Flusso dati in tempo reale: IMU, temperatura, 3 canali ottici. */
export const FRAME_CHARACTERISTIC = mendiUuid(0xabb1);
/** Lettura/scrittura registri del sensore ottico. */
export const SENSOR_CHARACTERISTIC = mendiUuid(0xabb2);
/** Lettura/scrittura registri IMU. */
export const IMU_CHARACTERISTIC = mendiUuid(0xabb3);
/** Batteria: tensione, ricarica, USB. */
export const ADC_CHARACTERISTIC = mendiUuid(0xabb4);
/** Autodiagnosi all'accensione. */
export const DIAGNOSTICS_CHARACTERISTIC = mendiUuid(0xabb5);
/** Offset di corrente dei LED, autocalibrazione, risparmio energetico. */
export const CALIBRATION_CHARACTERISTIC = mendiUuid(0xabb6);

/** Prefisso del nome BLE pubblicizzato dalla fascia. */
export const MENDI_NAME_PREFIX = "Mendi";

/** Frequenza di campionamento tipica del frame (Hz). */
export const MENDI_FRAME_RATE_HZ = 25;
