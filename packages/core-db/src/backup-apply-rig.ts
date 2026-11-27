import { sql } from 'drizzle-orm';

import { upsertPreference } from './backup-apply-preference';
import {
  isRouteLatencyRecord,
  type RigRecord,
  type RouteLatencyRecord,
} from './backup-format';
import { found, type Database } from './repository';
import { routeLatency } from './schema';

async function upsertRouteLatency(
  db: Database,
  record: RouteLatencyRecord,
): Promise<number> {
  const { offsetMs, name, kind } = record;
  const rows = await db
    .insert(routeLatency)
    .values(record)
    .onConflictDoUpdate({
      target: routeLatency.route,
      set: { offsetMs, name, kind },
    })
    .returning({ id: sql<number>`rowid` });
  return found(rows, 'Route latency upsert').id;
}

export const upsertRigSetting = (db: Database, record: RigRecord) =>
  isRouteLatencyRecord(record)
    ? upsertRouteLatency(db, record)
    : upsertPreference(db, record);
