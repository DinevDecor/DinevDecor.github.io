import type { Domain } from "@reality-observatory/ontology";
import type { CorrelationEngine } from "@reality-observatory/correlation-engine";

export class DomainAlreadyOwnedError extends Error {
  constructor(domain: Domain, existingEngineId: string) {
    super(
      `Domain "${domain}" already has a registered Correlation Engine ` +
        `("${existingEngineId}"); only one authoritative instance per domain ` +
        `is allowed (docs/adr/0010).`
    );
    this.name = "DomainAlreadyOwnedError";
  }
}

/**
 * Minimal fixture enforcing the domain-exclusivity rule from docs/adr/0010:
 * at most one registered Correlation Engine instance per domain. Not a real
 * runtime registry — RI-001 uses it only to prove the rule is enforceable
 * and to regression-test it.
 */
export class CorrelationEngineRegistry {
  private engineIdByDomain = new Map<Domain, string>();

  register(engine: CorrelationEngine): void {
    const { domain, id } = engine.manifest;
    const existing = this.engineIdByDomain.get(domain);
    if (existing !== undefined) {
      throw new DomainAlreadyOwnedError(domain, existing);
    }
    this.engineIdByDomain.set(domain, id);
  }
}
