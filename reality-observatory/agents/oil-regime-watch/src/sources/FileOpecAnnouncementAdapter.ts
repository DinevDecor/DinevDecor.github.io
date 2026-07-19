import { readOpecAnnouncementFeed } from "../config.js";
import type { OpecAnnouncementAdapter, RawOpecAnnouncement } from "./SourceAdapter.js";

/**
 * Real OPEC+ announcement adapter: reads the operator-curated feed file
 * (config/opec-announcements.example.json is the template). Deliberately
 * not a scraper and does not summarize anything with AI — OPEC+ decisions
 * are sparse, high-stakes policy announcements; this agent treats them as
 * structured input an analyst curates, not text to be parsed
 * automatically. See README, "Scope".
 */
export class FileOpecAnnouncementAdapter implements OpecAnnouncementAdapter {
  constructor(private readonly feedPath: string) {}

  async fetchNewAnnouncementsSince(lastSeenId: string | undefined): Promise<readonly RawOpecAnnouncement[]> {
    const entries = readOpecAnnouncementFeed(this.feedPath);
    if (lastSeenId === undefined) return entries;
    const lastIndex = entries.findIndex((entry) => entry.id === lastSeenId);
    return lastIndex === -1 ? entries : entries.slice(lastIndex + 1);
  }
}
