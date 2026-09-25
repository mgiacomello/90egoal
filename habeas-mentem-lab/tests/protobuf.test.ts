import { describe, expect, it } from "vitest";
import {
  decodeAdc,
  decodeCalibration,
  decodeDiagnostics,
  decodeFrame,
  encodeAdc,
  encodeCalibration,
  encodeFrame,
} from "../src/mendi/protobuf";

describe("protobuf Mendi", () => {
  it("decodifica un frame codificato a mano secondo device_v4.proto", () => {
    // ir_l = 8 (tag 0x40) = 300 → varint AC 02; temp = 7 (tag 0x3D fixed32) = 33.5
    const bytes = Uint8Array.from([0x40, 0xac, 0x02, 0x3d, 0x00, 0x00, 0x06, 0x42]);
    const f = decodeFrame(bytes, 1000);
    expect(f).not.toBeNull();
    expect(f!.irLeft).toBe(300);
    expect(f!.temperature).toBeCloseTo(33.5, 5);
    expect(f!.irRight).toBe(0); // campo omesso → 0
    expect(f!.timestamp).toBe(1000);
  });

  it("rifiuta un payload vuoto (non è un frame) e byte corrotti", () => {
    expect(decodeFrame(new Uint8Array())).toBeNull();
    expect(decodeFrame(Uint8Array.from([0x40, 0xff]))).toBeNull(); // varint troncato
  });

  it("fa il giro completo encode → decode con valori negativi dell'IMU", () => {
    const original = {
      accX: -1234, accY: 16384, accZ: -7,
      angX: 5, angY: -5, angZ: 0,
      temperature: 34.25,
      irLeft: 52000, redLeft: 31000, ambLeft: 800,
      irRight: 50500, redRight: 30200, ambRight: 780,
      irPulse: 60000, redPulse: 35000, ambPulse: 900,
    };
    const decoded = decodeFrame(encodeFrame(original), 5);
    expect(decoded).toMatchObject(original);
  });

  it("decodifica batteria, diagnostica e calibrazione", () => {
    const adc = decodeAdc(encodeAdc({ voltageMv: 3510, charging: true, usb: false }), 1)!;
    expect(adc).toMatchObject({ voltageMv: 3510, charging: true, usb: false });

    // Diagnostics: campo 1 (Adc annidato, wire 2), campo 2 imu_ok, campo 3 sensor_ok
    const inner = encodeAdc({ voltageMv: 3900, charging: false, usb: true });
    const diag = Uint8Array.from([0x0a, inner.length, ...inner, 0x10, 0x01, 0x18, 0x01]);
    const d = decodeDiagnostics(diag, 1)!;
    expect(d.imuOk).toBe(true);
    expect(d.sensorOk).toBe(true);
    expect(d.adc?.voltageMv).toBe(3900);
    expect(d.adc?.usb).toBe(true);

    const cal = decodeCalibration(
      encodeCalibration({ offsetLeft: -12.5, offsetRight: 3, offsetPulse: 0, autoCalibration: true, lowPowerMode: false }),
      1,
    )!;
    expect(cal.offsetLeft).toBeCloseTo(-12.5);
    expect(cal.offsetRight).toBeCloseTo(3);
    expect(cal.autoCalibration).toBe(true);
  });
});

describe("messaggio Sensor", () => {
  it("read=true è il varint del campo 1, come nell'app Mendi", async () => {
    const { encodeSensor } = await import("../src/mendi/protobuf");
    expect(Array.from(encodeSensor(true))).toEqual([0x08, 0x01]);
    expect(Array.from(encodeSensor(false))).toEqual([]);
    expect(Array.from(encodeSensor(true, 5))).toEqual([0x08, 0x01, 0x10, 0x05]);
  });

  it("decodifica la risposta di lettura registro (data è fixed32)", async () => {
    const { decodeSensor, encodeSensor } = await import("../src/mendi/protobuf");
    expect(decodeSensor(encodeSensor(true, 0x12, 0xabcdef))).toEqual({ read: true, address: 0x12, data: 0xabcdef });
    expect(decodeSensor(new Uint8Array())).toEqual({ read: false, address: 0, data: 0 });
  });
});
