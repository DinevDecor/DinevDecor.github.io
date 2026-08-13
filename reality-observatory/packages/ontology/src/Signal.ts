import type { Provenance, SensorId, SignalId, Timestamp } from "./common.js";
import type { SensorModality } from "./Sensor.js";

export interface SignalQuality {
  /** 0..1, higher means noisier. */
  readonly noiseLevel?: number;
  readonly calibrationRef?: string;
}

/**
 * A raw or lightly-processed data point emitted by a Sensor. Immutable and
 * timestamped, prior to any semantic interpretation (see Evidence).
 */
export interface Signal<TPayload = unknown> extends Provenance {
  readonly id: SignalId;
  readonly sensorId: SensorId;
  readonly modality: SensorModality;
  /** When the real-world reading occurred. */
  readonly capturedAt: Timestamp;
  /** When the system received it. */
  readonly ingestedAt: Timestamp;
  readonly payload: TPayload;
  readonly unit?: string;
  readonly quality?: SignalQuality;
}
