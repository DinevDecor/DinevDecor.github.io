/**
 * Explicit allow-list of actions an agent may request in its manifest.
 * The runtime grants nothing that isn't declared (see docs/adr/0003).
 */
export type AgentCapability =
  | "sensor:register"
  | "sensor:discover"
  | "sensor:emit-signal"
  | "evidence:publish"
  | "hypothesis:publish"
  | "event:publish"
  | "outcome:publish"
  | "prediction:publish"
  | "trust:read"
  | "storage:read"
  | "storage:write";
