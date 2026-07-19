import type { OpecAnnouncementAdapter, RawOpecAnnouncement } from "../SourceAdapter.js";

/** Deterministic, in-memory stand-in for FileOpecAnnouncementAdapter — used by the automated test suite. */
export class FixtureOpecAnnouncementAdapter implements OpecAnnouncementAdapter {
  private readonly entries: RawOpecAnnouncement[];

  constructor(initialEntries: readonly RawOpecAnnouncement[] = []) {
    this.entries = [...initialEntries];
  }

  async fetchNewAnnouncementsSince(lastSeenId: string | undefined): Promise<readonly RawOpecAnnouncement[]> {
    if (lastSeenId === undefined) return this.entries;
    const lastIndex = this.entries.findIndex((entry) => entry.id === lastSeenId);
    return lastIndex === -1 ? this.entries : this.entries.slice(lastIndex + 1);
  }

  /** Test helper: simulates a new announcement being curated into the feed. */
  pushAnnouncement(entry: RawOpecAnnouncement): void {
    this.entries.push(entry);
  }
}
