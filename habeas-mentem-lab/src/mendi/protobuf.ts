// Decoder protobuf (proto3) minimale per i messaggi Mendi.
//
// Non serve una libreria: i messaggi usano solo varint (int32/uint32/bool),
// fixed32 e float. In proto3 i campi omessi valgono 0.

import type { AdcReading, CalibrationReading, DiagnosticsReading, Frame } from "./types";

type Field =
  | { n: number; wire: 0; value: bigint }
  | { n: number; wire: 5; value: number; raw: number }
  | { n: number; wire: 2; value: Uint8Array };

function readVarint(buf: Uint8Array, pos: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  for (;;) {
    if (pos >= buf.length) throw new Error("varint troncato");
    const b = buf[pos++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [result, pos];
    shift += 7n;
    if (shift > 63n) throw new Error("varint troppo lungo");
  }
}

/** Scompone un messaggio in campi grezzi (numero, wire type, valore). */
export function readFields(buf: Uint8Array): Field[] {
  const fields: Field[] = [];
  let pos = 0;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  while (pos < buf.length) {
    const [tag, p] = readVarint(buf, pos);
    pos = p;
    const n = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (wire === 0) {
      const [value, p2] = readVarint(buf, pos);
      pos = p2;
      fields.push({ n, wire: 0, value });
    } else if (wire === 5) {
      if (pos + 4 > buf.length) throw new Error("fixed32 troncato");
      fields.push({ n, wire: 5, value: view.getFloat32(pos, true), raw: view.getUint32(pos, true) });
      pos += 4;
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, pos);
      pos = p2;
      const end = pos + Number(len);
      if (end > buf.length) throw new Error("bytes troncati");
      fields.push({ n, wire: 2, value: buf.subarray(pos, end) });
      pos = end;
    } else if (wire === 1) {
      pos += 8; // fixed64: non usato da Mendi, lo saltiamo
    } else {
      throw new Error(`wire type non supportato: ${wire}`);
    }
  }
  return fields;
}

/** int32 in proto3: varint a 64 bit, riportato ai 32 bit con segno. */
function toInt32(v: bigint): number {
  return Number(BigInt.asIntN(32, v));
}

function toUint32(v: bigint): number {
  return Number(BigInt.asUintN(32, v));
}

/** Decodifica un Frame (caratteristica 0xABB1). Un payload vuoto non è un frame. */
export function decodeFrame(buf: Uint8Array, timestamp = Date.now()): Frame | null {
  if (buf.length === 0) return null;
  let fields: Field[];
  try {
    fields = readFields(buf);
  } catch {
    return null;
  }
  const f: Frame = {
    timestamp,
    accX: 0, accY: 0, accZ: 0,
    angX: 0, angY: 0, angZ: 0,
    temperature: 0,
    irLeft: 0, redLeft: 0, ambLeft: 0,
    irRight: 0, redRight: 0, ambRight: 0,
    irPulse: 0, redPulse: 0, ambPulse: 0,
  };
  for (const fld of fields) {
    if (fld.wire === 0) {
      const v = toInt32(fld.value);
      switch (fld.n) {
        case 1: f.accX = v; break;
        case 2: f.accY = v; break;
        case 3: f.accZ = v; break;
        case 4: f.angX = v; break;
        case 5: f.angY = v; break;
        case 6: f.angZ = v; break;
        case 8: f.irLeft = v; break;
        case 9: f.redLeft = v; break;
        case 10: f.ambLeft = v; break;
        case 11: f.irRight = v; break;
        case 12: f.redRight = v; break;
        case 13: f.ambRight = v; break;
        case 14: f.irPulse = v; break;
        case 15: f.redPulse = v; break;
        case 16: f.ambPulse = v; break;
      }
    } else if (fld.wire === 5 && fld.n === 7) {
      f.temperature = fld.value;
    }
  }
  return f;
}

/** Decodifica Adc (caratteristica 0xABB4). */
export function decodeAdc(buf: Uint8Array, timestamp = Date.now()): AdcReading | null {
  try {
    const r: AdcReading = { timestamp, voltageMv: 0, charging: false, usb: false };
    for (const fld of readFields(buf)) {
      if (fld.wire !== 0) continue;
      if (fld.n === 1) r.voltageMv = toUint32(fld.value);
      else if (fld.n === 2) r.charging = fld.value !== 0n;
      else if (fld.n === 3) r.usb = fld.value !== 0n;
    }
    return r;
  } catch {
    return null;
  }
}

/** Decodifica Diagnostics (caratteristica 0xABB5). */
export function decodeDiagnostics(buf: Uint8Array, timestamp = Date.now()): DiagnosticsReading | null {
  try {
    const r: DiagnosticsReading = { timestamp, adc: null, imuOk: false, sensorOk: false };
    for (const fld of readFields(buf)) {
      if (fld.wire === 2 && fld.n === 1) r.adc = decodeAdc(fld.value, timestamp);
      else if (fld.wire === 0 && fld.n === 2) r.imuOk = fld.value !== 0n;
      else if (fld.wire === 0 && fld.n === 3) r.sensorOk = fld.value !== 0n;
    }
    return r;
  } catch {
    return null;
  }
}

/** Decodifica Sensor (0xABB2): risposta a una lettura di registro. */
export function decodeSensor(buf: Uint8Array): { read: boolean; address: number; data: number } | null {
  try {
    const r = { read: false, address: 0, data: 0 };
    for (const fld of readFields(buf)) {
      if (fld.wire === 0 && fld.n === 1) r.read = fld.value !== 0n;
      else if (fld.wire === 0 && fld.n === 2) r.address = toUint32(fld.value);
      else if (fld.wire === 5 && fld.n === 3) r.data = fld.raw;
    }
    return r;
  } catch {
    return null;
  }
}

/** Decodifica Calibration (caratteristica 0xABB6). */
export function decodeCalibration(buf: Uint8Array, timestamp = Date.now()): CalibrationReading | null {
  try {
    const r: CalibrationReading = {
      timestamp, offsetLeft: 0, offsetRight: 0, offsetPulse: 0, autoCalibration: false, lowPowerMode: false,
    };
    for (const fld of readFields(buf)) {
      if (fld.wire === 5 && fld.n === 1) r.offsetLeft = fld.value;
      else if (fld.wire === 5 && fld.n === 2) r.offsetRight = fld.value;
      else if (fld.wire === 5 && fld.n === 3) r.offsetPulse = fld.value;
      else if (fld.wire === 0 && fld.n === 4) r.autoCalibration = fld.value !== 0n;
      else if (fld.wire === 0 && fld.n === 5) r.lowPowerMode = fld.value !== 0n;
    }
    return r;
  } catch {
    return null;
  }
}

// ── Encoder (serve al simulatore, ai test e alla scrittura della calibrazione) ──

function writeVarint(out: number[], v: bigint): void {
  let x = BigInt.asUintN(64, v);
  while (x >= 0x80n) {
    out.push(Number(x & 0x7fn) | 0x80);
    x >>= 7n;
  }
  out.push(Number(x));
}

function writeInt32Field(out: number[], n: number, v: number): void {
  if (v === 0) return; // proto3: i valori di default non si serializzano
  writeVarint(out, BigInt(n << 3));
  writeVarint(out, BigInt(v)); // negativi → 10 byte, come proto3 int32
}

function writeBoolField(out: number[], n: number, v: boolean): void {
  if (!v) return;
  writeVarint(out, BigInt(n << 3));
  out.push(1);
}

function writeFloatField(out: number[], n: number, v: number): void {
  if (v === 0) return;
  writeVarint(out, BigInt((n << 3) | 5));
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  out.push(...b);
}

export function encodeFrame(f: Omit<Frame, "timestamp">): Uint8Array {
  const out: number[] = [];
  writeInt32Field(out, 1, f.accX);
  writeInt32Field(out, 2, f.accY);
  writeInt32Field(out, 3, f.accZ);
  writeInt32Field(out, 4, f.angX);
  writeInt32Field(out, 5, f.angY);
  writeInt32Field(out, 6, f.angZ);
  writeFloatField(out, 7, f.temperature);
  writeInt32Field(out, 8, f.irLeft);
  writeInt32Field(out, 9, f.redLeft);
  writeInt32Field(out, 10, f.ambLeft);
  writeInt32Field(out, 11, f.irRight);
  writeInt32Field(out, 12, f.redRight);
  writeInt32Field(out, 13, f.ambRight);
  writeInt32Field(out, 14, f.irPulse);
  writeInt32Field(out, 15, f.redPulse);
  writeInt32Field(out, 16, f.ambPulse);
  return Uint8Array.from(out);
}

export function encodeAdc(a: Omit<AdcReading, "timestamp">): Uint8Array {
  const out: number[] = [];
  writeInt32Field(out, 1, a.voltageMv);
  writeBoolField(out, 2, a.charging);
  writeBoolField(out, 3, a.usb);
  return Uint8Array.from(out);
}

/** Sensor (0xABB2): read=true accende il flusso ottico, read=false lo spegne (flusso dell'app Mendi). */
export function encodeSensor(read: boolean, address = 0, data = 0): Uint8Array {
  const out: number[] = [];
  writeBoolField(out, 1, read);
  writeInt32Field(out, 2, address);
  if (data !== 0) {
    writeVarint(out, BigInt((3 << 3) | 5));
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, data, true);
    out.push(...b);
  }
  return Uint8Array.from(out);
}

export function encodeCalibration(c: Omit<CalibrationReading, "timestamp">): Uint8Array {
  const out: number[] = [];
  writeFloatField(out, 1, c.offsetLeft);
  writeFloatField(out, 2, c.offsetRight);
  writeFloatField(out, 3, c.offsetPulse);
  writeBoolField(out, 4, c.autoCalibration);
  writeBoolField(out, 5, c.lowPowerMode);
  return Uint8Array.from(out);
}
