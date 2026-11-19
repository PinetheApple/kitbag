import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { eq } from 'drizzle-orm';

import { GRID_METER } from './meter-override';
import { stems, stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import type { NewStemBundle } from './stem-bundle-repository';
import {
  SAME_SONG_DURATION_TOLERANCE_SEC,
  type StemSetIdentity,
} from './stem-set-match';
import { STEM_SET_SOURCE } from './stem-set-source';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, library: createSongLibraryRepository(handle) };
}

const RATE = 48000;
const LONGEST_SEC = 200;
const SHORTER_SEC = 150;
const SLOWER = 0.75;
const DECIDED_TOLERANCE_SEC = 2;
const PAST_TOLERANCE_SEC = 0.1;
const BAR_ONE_SEC = 1.5;
const DRUMS_KEY = -2;
const RETIMED = [11.9, 15.2];
const LYRICS = {
  synced: '[00:12.25]First line\n[00:15.80]Second line',
  plain: null,
  offsetSec: 0,
  instrumental: false,
};

function bundle(
  jobId: string,
  roles: readonly string[] = ['vocals', 'drums'],
): NewStemBundle {
  const folder = `stems/${jobId}`;
  return {
    uuid: `uuid-${jobId}`,
    jobId,
    title: 'Echo',
    songTitle: 'Echo',
    artist: 'Charity Gayle',
    folder,
    sampleRate: RATE,
    channels: 2,
    stems: roles.map((role, i) => ({
      name: role,
      filePath: `${folder}/${role}.flac`,
      waveformPath: null,
      frames: (i === 0 ? LONGEST_SEC : SHORTER_SEC) * RATE,
      volume: 1,
      muted: false,
      soloed: false,
      pitch: 0,
    })),
    hasMix: false,
    bpm: null,
    key: null,
    scale: null,
    keyConfidence: null,
    loudnessLufs: null,
    tempoStability: null,
    sections: [],
    beats: [],
    bars: [],
    lyrics: null,
  };
}

const ECHO: StemSetIdentity = {
  title: 'Echo',
  artist: 'Charity Gayle',
  durationSec: LONGEST_SEC,
};

describe('finding a stem song StemDeck separated again', () => {
  it('matches title and artist trimmed and case-folded, and the longest stem within the tolerance', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(bundle('old-job'));
    expect(
      await library.findStemSetMatches({
        title: '  ECHO ',
        artist: 'charity gayle ',
        durationSec: LONGEST_SEC + SAME_SONG_DURATION_TOLERANCE_SEC,
      }),
    ).toEqual([{ id, title: 'Echo' }]);
  });

  it('allows the decided 2 s between the longest stems', () => {
    expect(SAME_SONG_DURATION_TOLERANCE_SEC).toBe(DECIDED_TOLERANCE_SEC);
  });

  it('matches the song title when the bundle title differs', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle({
      ...bundle('old-job'),
      title: 'Charity Gayle - Echo',
    });
    expect(await library.findStemSetMatches(ECHO)).toEqual([
      { id, title: 'Charity Gayle - Echo' },
    ]);
  });

  it('lists the newest match first', async () => {
    const { library } = setup();
    const first = await library.insertStemBundle(bundle('job-1'));
    const second = await library.insertStemBundle(bundle('job-2'));
    expect(
      (await library.findStemSetMatches(ECHO)).map(({ id }) => id),
    ).toEqual([second, first]);
  });

  it.each([
    ['the title differs', { title: 'Echoes' }],
    ['the artist differs', { artist: 'Someone Else' }],
    ['the artist is missing', { artist: null }],
    ['the title is empty', { title: ' ' }],
    [
      'the duration is just past the tolerance',
      {
        durationSec:
          LONGEST_SEC + SAME_SONG_DURATION_TOLERANCE_SEC + PAST_TOLERANCE_SEC,
      },
    ],
  ])('does not match when %s', async (_, change) => {
    const { library } = setup();
    await library.insertStemBundle(bundle('old-job'));
    expect(await library.findStemSetMatches({ ...ECHO, ...change })).toEqual(
      [],
    );
  });

  it('ignores stem sets that did not come from StemDeck', async () => {
    const { handle, library } = setup();
    await library.insertStemBundle(bundle('old-job'));
    await handle.db.update(stemSets).set({ source: STEM_SET_SOURCE.folder });
    expect(await library.findStemSetMatches(ECHO)).toEqual([]);
  });
});

describe('replacing a matched stem song', () => {
  async function seeded() {
    const context = setup();
    const { handle, library } = context;
    const old = await library.insertStemBundle({
      ...bundle('old-job'),
      lyrics: LYRICS,
    });
    const [vocals, drums] = (await library.readStemSet(old))?.stems ?? [];
    if (vocals === undefined || drums === undefined) throw new Error('setup');
    await library.renameStemSet(old, 'Echo (live)');
    await library.renameStem(drums.id, 'Kit');
    await library.saveStemSetMeterOverride(old, {
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: BAR_ONE_SEC,
    });
    await handle.db.update(stemSets).set({ speed: SLOWER });
    await handle.db
      .update(stems)
      .set({ pitch: DRUMS_KEY })
      .where(eq(stems.id, drums.id));
    await library.saveLyricsRetimed(old, RETIMED);
    await library.saveStemMix([
      { id: vocals.id, volume: 0.25, muted: true, soloed: false },
      { id: drums.id, volume: 1.5, muted: false, soloed: true },
    ]);
    return { ...context, old };
  }

  it('swaps in the new job and keeps speed, renames and the meter but not bar one', async () => {
    const { library, old } = await seeded();
    const outcome = await library.replaceStemBundle(bundle('new-job'), old);
    expect(outcome.replaced?.folder).toBe('stems/old-job');
    expect(await library.readStemSet(old)).toBeUndefined();
    expect(await library.readStemSet(outcome.id)).toMatchObject({
      jobId: 'new-job',
      title: 'Echo (live)',
      speed: SLOWER,
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: null,
      stems: [
        expect.objectContaining({ role: 'vocals', name: 'vocals' }),
        expect.objectContaining({ role: 'drums', name: 'Kit' }),
      ],
    });
  });

  it('keeps bar one and the lyric retiming when the same job is imported again', async () => {
    const { library, old } = await seeded();
    const outcome = await library.replaceStemBundle(
      { ...bundle('old-job'), uuid: 'uuid-again', lyrics: LYRICS },
      old,
    );
    expect(await library.readStemSet(outcome.id)).toMatchObject({
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: BAR_ONE_SEC,
      lyricsRetimed: RETIMED,
    });
  });

  it('drops the lyric retiming for another job, even with the same lyrics', async () => {
    const { library, old } = await seeded();
    const outcome = await library.replaceStemBundle(
      { ...bundle('new-job'), lyrics: LYRICS },
      old,
    );
    expect((await library.readStemSet(outcome.id))?.lyricsRetimed).toBeNull();
  });

  it('keeps the saved mix and key by stem name when the bundle has none, unity for a new stem', async () => {
    const { library, old } = await seeded();
    const outcome = await library.replaceStemBundle(
      bundle('new-job', ['vocals', 'drums', 'bass']),
      old,
    );
    const mixes = (await library.readStemSet(outcome.id))?.stems.map(
      ({ role, volume, muted, soloed, pitch }) => [
        role,
        volume,
        muted,
        soloed,
        pitch,
      ],
    );
    expect(mixes).toEqual([
      ['vocals', 0.25, true, false, 0],
      ['drums', 1.5, false, true, DRUMS_KEY],
      ['bass', 1, false, false, 0],
    ]);
  });

  it('takes the mix from the bundle when it carries one', async () => {
    const { library, old } = await seeded();
    const fresh = bundle('new-job');
    const outcome = await library.replaceStemBundle(
      {
        ...fresh,
        hasMix: true,
        stems: fresh.stems.map((stem) => ({ ...stem, volume: 0.5 })),
      },
      old,
    );
    const mixes = (await library.readStemSet(outcome.id))?.stems.map(
      ({ volume, muted, soloed, pitch }) => [volume, muted, soloed, pitch],
    );
    expect(mixes).toEqual([
      [0.5, false, false, 0],
      [0.5, false, false, 0],
    ]);
  });

  it('rolls a failed replace back, keeping the old song as it was', async () => {
    const { library, old } = await seeded();
    const before = await library.readStemSet(old);
    const broken = {
      ...bundle('new-job'),
      stems: [{ ...bundle('new-job').stems[0], filePath: null }],
    } as unknown as NewStemBundle;
    await expect(library.replaceStemBundle(broken, old)).rejects.toThrow();
    expect(await library.readStemSet(old)).toEqual(before);
    expect(await library.findStemSetByJobId('new-job')).toBeUndefined();
  });
});
