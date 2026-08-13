import type { PriceAdapter, RawPriceObservation } from "../SourceAdapter.js";

/** Deterministic, in-memory stand-in for EiaPriceAdapter — used by the automated test suite. */
export class FixturePriceAdapter implements PriceAdapter {
  private readonly history: RawPriceObservation[];

  constructor(initialHistory: readonly RawPriceObservation[]) {
    this.history = [...initialHistory];
  }

  async fetchLatest(): Promise<RawPriceObservation> {
    const latest = this.history[this.history.length - 1];
    if (!latest) throw new Error("FixturePriceAdapter has no configured observations");
    return latest;
  }

  /** Test helper: simulates the next price observation (e.g. the market move a Prediction is resolved against). */
  pushLatest(observation: RawPriceObservation): void {
    this.history.push(observation);
  }
}
