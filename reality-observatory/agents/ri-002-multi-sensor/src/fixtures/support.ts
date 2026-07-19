/**
 * Small shared fixture implementations reused by both AgentContext and
 * CorrelationContext — logger/storage/clock shapes are structurally
 * identical across the two contexts, so one implementation satisfies both.
 */

export interface SupportLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function createConsoleLogger(prefix: string): SupportLogger {
  const format = (level: string, message: string, meta?: Record<string, unknown>): string =>
    meta ? `[${prefix}] ${level}: ${message} ${JSON.stringify(meta)}` : `[${prefix}] ${level}: ${message}`;
  return {
    debug: (message, meta) => console.debug(format("debug", message, meta)),
    info: (message, meta) => console.info(format("info", message, meta)),
    warn: (message, meta) => console.warn(format("warn", message, meta)),
    error: (message, meta) => console.error(format("error", message, meta)),
  };
}

export interface SupportStorage {
  get<TValue>(key: string): Promise<TValue | undefined>;
  set<TValue>(key: string, value: TValue): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createInMemoryStorage(): SupportStorage {
  const store = new Map<string, unknown>();
  return {
    get: async <TValue>(key: string): Promise<TValue | undefined> => store.get(key) as TValue | undefined,
    set: async <TValue>(key: string, value: TValue): Promise<void> => {
      store.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key);
    },
  };
}

export interface SupportClock {
  now(): Date;
}

/** A clock that always returns the same fixed instant — determinism, never a real wall clock. */
export function createFixedClock(iso: string): SupportClock {
  const fixed = new Date(iso);
  return { now: () => fixed };
}
