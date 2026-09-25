import { asc, eq, or } from 'drizzle-orm';

import {
  escapedLike,
  found,
  type Database,
  type DatabaseHandle,
  type NewSongPreset,
  type SongPreset,
} from './repository';
import { presetViolation } from './preset-rules';
import { DEFAULT_DENOMINATOR, setlistItems, songPresets } from './schema';

function checkPreset(values: NewSongPreset) {
  const violation = presetViolation({
    ...values,
    denominator: values.denominator ?? DEFAULT_DENOMINATOR,
    perAccentSounds: values.perAccentSounds ?? null,
    polyAccents: values.polyAccents ?? null,
  });
  if (violation)
    throw new RangeError(`Song preset ${violation.field}: ${violation.reason}`);
}

function presetById(db: Database, id: number) {
  return db.select().from(songPresets).where(eq(songPresets.id, id));
}

async function searchPresets(db: Database, query: string) {
  return db
    .select()
    .from(songPresets)
    .where(
      or(
        escapedLike(songPresets.name, query),
        escapedLike(songPresets.title, query),
        escapedLike(songPresets.artist, query),
      ),
    )
    .orderBy(asc(songPresets.id));
}

async function insertPreset(
  db: Database,
  values: NewSongPreset,
): Promise<SongPreset> {
  checkPreset(values);
  return found(
    await db
      .insert(songPresets)
      .values({ ...values, uuid: crypto.randomUUID() })
      .returning(),
    'Preset insert',
  );
}

async function duplicatePreset(
  db: Database,
  id: number,
  name: string,
): Promise<SongPreset> {
  const source = found(await presetById(db, id), `Song preset ${String(id)}`);
  const copy: NewSongPreset = { ...source, name };
  delete copy.id;
  return insertPreset(db, copy);
}

async function updatePreset(
  db: Database,
  id: number,
  values: Partial<Omit<NewSongPreset, 'id'>>,
) {
  const current = found(await presetById(db, id), `Song preset ${String(id)}`);
  checkPreset({ ...current, ...values });
  await db.update(songPresets).set(values).where(eq(songPresets.id, id));
}

async function deletePreset(db: Database, id: number) {
  await db.delete(setlistItems).where(eq(setlistItems.songPresetId, id));
  await db.delete(songPresets).where(eq(songPresets.id, id));
}

export function createSongPresetRepository({ db, transactor }: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    get: (id: number) => serial(async () => (await presetById(db, id)).at(0)),
    list: () =>
      serial(() => db.select().from(songPresets).orderBy(asc(songPresets.id))),
    search: (query: string) => serial(() => searchPresets(db, query)),
    create: (values: NewSongPreset) => serial(() => insertPreset(db, values)),
    update: (id: number, values: Partial<Omit<NewSongPreset, 'id'>>) =>
      transaction(() => updatePreset(db, id, values)),
    duplicate: (id: number, name: string) =>
      serial(() => duplicatePreset(db, id, name)),
    delete: (id: number) => transaction(() => deletePreset(db, id)),
  };
}
