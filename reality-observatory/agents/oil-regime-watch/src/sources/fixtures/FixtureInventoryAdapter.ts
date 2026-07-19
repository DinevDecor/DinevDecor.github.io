import type { InventoryAdapter, RawInventoryObservation } from "../SourceAdapter.js";

/** Deterministic, in-memory stand-in for EiaInventoryAdapter — used by the automated test suite. */
export class FixtureInventoryAdapter implements InventoryAdapter {
  private readonly history: RawInventoryObservation[];

  constructor(initialHistory: readonly RawInventoryObservation[]) {
    this.history = [...initialHistory];
  }

  async fetchLatest(): Promise<RawInventoryObservation> {
    const latest = this.history[this.history.length - 1];
    if (!latest) throw new Error("FixtureInventoryAdapter has no configured observations");
    return latest;
  }

  async fetchTrailingHistory(weeks: number): Promise<readonly RawInventoryObservation[]> {
    return this.history.slice(-weeks);
  }

  /** Test helper: simulates a new weekly report arriving. */
  pushLatest(observation: RawInventoryObservation): void {
    this.history.push(observation);
  }
}
