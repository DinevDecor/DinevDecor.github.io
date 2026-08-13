/**
 * Explicit allow-list of actions an agent may request in its manifest.
 * The runtime grants nothing that isn't declared (see docs/adr/0003).
 *
 * Deliberately excludes "event:publish": producing Event is reserved
 * exclusively for a registered Correlation Engine instance (docs/adr/0010).
 * That exclusivity is enforced by the type system, not only by this
 * comment — see AgentEventBus and docs/adr/0011.
 */
export type AgentCapability =
  | "sensor:register"
  | "sensor:discover"
  | "sensor:emit-signal"
  | "evidence:publish"
  | "hypothesis:publish"
  | "outcome:publish"
  | "prediction:publish"
  | "trust:read"
  | "storage:read"
  | "storage:write";
