import { and, eq } from 'drizzle-orm';

import {
  saveStemSetClick,
  stemSetClickOf,
  type StemSetClick,
} from './click-settings';
import {
  meterOverrideOf,
  saveMeterOverride,
  type MeterOverride,
} from './meter-override';
import type { Database } from './repository';
import { stems, stemSets } from './schema';
import type { NewStemBundle } from './stem-bundle-repository';
import {
  retainedRetime,
  saveLyricsRetimed,
  type LyricLineTimes,
} from './stem-lyrics';
import { applyUserNames, readUserNames, type UserNames } from './stem-rename';
import {
  carriedTempoMode,
  saveChosenTempoMode,
  STEM_SET_TEMPO_COLUMNS,
  stemSetTempoOf,
} from './stem-tempo';
import type { TempoMode } from './tempo-mode';

interface RoleMix {
  readonly role: string;
  readonly gain: number;
  readonly muted: boolean;
  readonly soloed: boolean;
  readonly pitch: number;
}

interface KeptOnReplace {
  readonly names: UserNames;
  readonly retimed: LyricLineTimes | null;
  readonly meter: MeterOverride;
  readonly tempoMode: TempoMode | null;
  readonly speed: number;
  readonly click: StemSetClick;
  readonly mixes: readonly RoleMix[];
}

async function readRoleMixes(db: Database, id: number): Promise<RoleMix[]> {
  return db
    .select({
      role: stems.role,
      gain: stems.gain,
      muted: stems.muted,
      soloed: stems.soloed,
      pitch: stems.pitch,
    })
    .from(stems)
    .where(eq(stems.stemSetId, id));
}

async function applyRoleMixes(
  db: Database,
  id: number,
  mixes: readonly RoleMix[],
): Promise<void> {
  for (const { role, ...mix } of mixes)
    await db
      .update(stems)
      .set(mix)
      .where(and(eq(stems.stemSetId, id), eq(stems.role, role)));
}

// Bar one and lyric line times are times in the old job's audio.
function carriedMeter(meter: MeterOverride, sameJob: boolean): MeterOverride {
  return sameJob ? meter : { ...meter, barOneSeconds: null };
}

export async function readKept(
  db: Database,
  id: number,
  bundle: NewStemBundle,
): Promise<KeptOnReplace | undefined> {
  const [row] = await db
    .select({
      meterBeatsPerBar: stemSets.meterBeatsPerBar,
      barOneSeconds: stemSets.barOneSeconds,
      ...STEM_SET_TEMPO_COLUMNS,
      speed: stemSets.speed,
      clickGrouping: stemSets.clickGrouping,
      clickRate: stemSets.clickRate,
      jobId: stemSets.stemdeckJobId,
    })
    .from(stemSets)
    .where(eq(stemSets.id, id));
  if (row === undefined) return undefined;
  const sameJob = row.jobId === bundle.jobId;
  return {
    names: await readUserNames(db, id),
    retimed: sameJob ? await retainedRetime(db, id, bundle.lyrics) : null,
    meter: carriedMeter(meterOverrideOf(row), sameJob),
    tempoMode: carriedTempoMode(
      stemSetTempoOf(row).chosenTempoMode,
      bundle.tempo,
    ),
    speed: row.speed,
    click: stemSetClickOf(row),
    mixes: bundle.hasMix ? [] : await readRoleMixes(db, id),
  };
}

export async function applyKept(
  db: Database,
  id: number,
  kept: KeptOnReplace,
): Promise<void> {
  await applyUserNames(db, id, kept.names);
  await saveLyricsRetimed(db, id, kept.retimed);
  await saveMeterOverride(db, stemSets, id, kept.meter);
  await saveChosenTempoMode(db, id, kept.tempoMode);
  await saveStemSetClick(db, id, kept.click);
  await db
    .update(stemSets)
    .set({ speed: kept.speed })
    .where(eq(stemSets.id, id));
  await applyRoleMixes(db, id, kept.mixes);
}
