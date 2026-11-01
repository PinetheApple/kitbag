import { eq } from 'drizzle-orm';

import type { DatabaseHandle } from './repository';
import { routeLatency } from './schema';

export type RouteLatency = typeof routeLatency.$inferSelect;

export interface RouteLatencyRepository {
  get(route: string): Promise<RouteLatency | null>;
  list(): Promise<RouteLatency[]>;
  save(entry: RouteLatency): Promise<void>;
}

export function createRouteLatencyRepository({
  db,
  transactor,
}: DatabaseHandle): RouteLatencyRepository {
  return {
    get: (route) =>
      transactor.serial(async () => {
        const [row] = await db
          .select()
          .from(routeLatency)
          .where(eq(routeLatency.route, route));
        return row ?? null;
      }),
    list: () => transactor.serial(() => db.select().from(routeLatency)),
    save: (entry) =>
      transactor.serial(async () => {
        const { offsetMs, name, kind } = entry;
        await db.insert(routeLatency).values(entry).onConflictDoUpdate({
          target: routeLatency.route,
          set: { offsetMs, name, kind },
        });
      }),
  };
}
