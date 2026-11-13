import type { PersistOptions } from "zustand/middleware";
import type { ZodType } from "zod";

type PersistMigrationMap<TState> = Record<number, (state: TState) => TState>;

interface BuildPersistOptionsArgs<TStore, TPersisted extends object> {
  name: string;
  version: number;
  schema: ZodType<TPersisted>;
  fallback: () => TPersisted;
  partialize: (state: TStore) => TPersisted;
  migrations?: PersistMigrationMap<TPersisted>;
}

function parseOrFallback<T>(schema: ZodType<T>, value: unknown, fallback: () => T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback();
}

export function buildPersistOptions<TStore, TPersisted extends object>({
  name,
  version,
  schema,
  fallback,
  partialize,
  migrations = {},
}: BuildPersistOptionsArgs<TStore, TPersisted>): PersistOptions<TStore, TPersisted> {
  return {
    name,
    version,
    partialize,
    migrate: (persistedState, persistedVersion) => {
      try {
        let nextState = persistedState as TPersisted;
        for (let v = persistedVersion + 1; v <= version; v++) {
          const migrateStep = migrations[v];
          if (migrateStep) nextState = migrateStep(nextState);
        }
        return parseOrFallback(schema, nextState, fallback);
      } catch {
        return fallback();
      }
    },
    merge: (persistedState, currentState) => {
      const safePersisted = parseOrFallback(schema, persistedState, fallback);
      return { ...currentState, ...safePersisted };
    },
  };
}
