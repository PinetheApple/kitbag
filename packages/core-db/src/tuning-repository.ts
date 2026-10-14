import { asc, eq } from 'drizzle-orm';

import {
  found,
  type Database,
  type DatabaseHandle,
  type NewTuning,
  type Tuning,
  type TuningRepository,
} from './repository';
import { tunings } from './schema';
import { tuningViolation } from './tuning-rules';

type TuningRow = typeof tunings.$inferSelect;

function checkTuning(values: NewTuning) {
  const violation = tuningViolation(values);
  if (violation)
    throw new RangeError(`Tuning ${violation.field}: ${violation.reason}`);
}

const toTuning = ({
  id,
  uuid,
  name,
  instrument,
  notes,
}: TuningRow): Tuning => ({
  id,
  uuid,
  name,
  instrument,
  notes: Array.from(notes),
});

function tuningById(db: Database, id: number) {
  return db.select().from(tunings).where(eq(tunings.id, id));
}

async function insertTuning(db: Database, values: NewTuning): Promise<Tuning> {
  checkTuning(values);
  const row = found(
    await db
      .insert(tunings)
      .values({
        name: values.name,
        instrument: values.instrument,
        notes: Uint8Array.from(values.notes),
        uuid: crypto.randomUUID(),
      })
      .returning(),
    'Tuning insert',
  );
  return toTuning(row);
}

async function updateTuning(
  db: Database,
  id: number,
  values: Partial<NewTuning>,
) {
  const current = toTuning(
    found(await tuningById(db, id), `Tuning ${String(id)}`),
  );
  const next = { ...current, ...values };
  checkTuning(next);
  await db
    .update(tunings)
    .set({
      name: next.name,
      instrument: next.instrument,
      notes: Uint8Array.from(next.notes),
    })
    .where(eq(tunings.id, id));
}

export function createTuningRepository({
  db,
  transactor,
}: DatabaseHandle): TuningRepository {
  const { serial, transaction } = transactor;
  return {
    list: () =>
      serial(async () =>
        (await db.select().from(tunings).orderBy(asc(tunings.id))).map(
          toTuning,
        ),
      ),
    create: (values) => serial(() => insertTuning(db, values)),
    update: (id, values) => transaction(() => updateTuning(db, id, values)),
    delete: (id) =>
      serial(async () => {
        await db.delete(tunings).where(eq(tunings.id, id));
      }),
  };
}
