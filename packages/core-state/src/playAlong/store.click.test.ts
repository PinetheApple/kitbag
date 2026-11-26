import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_BPM } from '../metronome/store.ts';
import {
  BPM,
  call,
  fakePlayAlong,
  FRAMES_PER_MS,
  PLAY_ALONG,
  SESSION_ID,
  snapshot,
  STANDALONE,
  START_MS,
} from './store.test-helper.ts';

const TAPPED_BPM = 96;
const TRIPLET = 3;
const TYPED_BPM = 100;
const FOUND_BPM = 120;
const NO_HOST = 'no host object';

afterEach(() => {
  vi.useRealTimers();
});

function clickAlone(fake = fakePlayAlong({ sessions: [] })) {
  fake.store.getState().startClick();
  return fake;
}

const NOW_FRAME = START_MS * FRAMES_PER_MS;

function songAppears(fake: ReturnType<typeof fakePlayAlong>) {
  fake.media.setState({ sessions: [snapshot()], chosenId: SESSION_ID });
}

describe('the click alone, with no song to follow', () => {
  it('has the standalone default tempo before any lookup or tap', () => {
    const fake = fakePlayAlong({ sessions: [] });
    expect(fake.store.getState().bpm).toBe(DEFAULT_BPM);
  });

  it('plays in the Play along slot at its tempo', () => {
    const fake = clickAlone();
    expect(fake.store.getState().clickPlaying).toBe(true);
    expect(fake.calls).toEqual(
      expect.arrayContaining([
        'yieldStandalone()',
        'engineHold()',
        call('metronomeSelectSlot', PLAY_ALONG),
        call('setTempo', DEFAULT_BPM),
        call('metronomeStart', NOW_FRAME),
      ]),
    );
    expect(fake.calls.at(-1)).toBe(call('metronomeStart', NOW_FRAME));
  });

  it('stops and hands the engine back to the standalone metronome', () => {
    const fake = clickAlone();
    fake.calls.length = 0;
    fake.store.getState().stopClick();
    expect(fake.store.getState().clickPlaying).toBe(false);
    expect(fake.calls).toEqual([
      'metronomeStop()',
      call('metronomeSelectSlot', STANDALONE),
      'standaloneReturned()',
      'engineRelease()',
    ]);
  });

  it('ends when the standalone metronome or a song starts', () => {
    const starting = new Set<() => void>();
    const fake = clickAlone(
      fakePlayAlong({
        sessions: [],
        onClickStarting: (listener) => {
          starting.add(listener);
          return () => {
            starting.delete(listener);
          };
        },
      }),
    );
    for (const listener of [...starting]) listener();
    expect(fake.store.getState().clickPlaying).toBe(false);
    expect(fake.calls.slice(-3)).toEqual([
      call('metronomeSelectSlot', STANDALONE),
      'standaloneReturned()',
      'engineRelease()',
    ]);
    expect(starting.size).toBe(0);
  });

  it('takes a typed tempo and a pattern edit while it plays', () => {
    const fake = clickAlone();
    fake.store.getState().setBpm(TAPPED_BPM);
    fake.store.getState().setSubdivision(TRIPLET);
    expect(fake.calls.slice(-2)).toEqual([
      call('setTempo', TAPPED_BPM),
      call('setSubdivision', TRIPLET),
    ]);
  });

  it('takes a tapped tempo from the tempo ladder', () => {
    const fake = clickAlone();
    const stop = fake.store.getState().watchLibrary();
    fake.ladder.tempo(TAPPED_BPM);
    expect(fake.store.getState().bpm).toBe(TAPPED_BPM);
    expect(fake.calls.at(-1)).toBe(call('setTempo', TAPPED_BPM));
    stop();
  });

  it('does not start while a song is there to follow', () => {
    const fake = fakePlayAlong();
    fake.store.getState().setBpm(BPM);
    fake.store.getState().startClick();
    expect(fake.store.getState().clickPlaying).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it('stops when a song appears to follow', () => {
    const fake = clickAlone();
    const stop = fake.store.getState().watchLibrary();
    songAppears(fake);
    expect(fake.store.getState().clickPlaying).toBe(false);
    expect(fake.calls).toContain(call('metronomeSelectSlot', STANDALONE));
    stop();
  });

  it('gives way to a song, then lets a tap lock take the slot afresh', () => {
    const fake = clickAlone();
    const stop = fake.store.getState().watchLibrary();
    songAppears(fake);
    expect(fake.store.getState().clickPlaying).toBe(false);
    const holds = (name: string) =>
      fake.calls.filter((entry) => entry === name).length;
    expect(holds('engineHold()')).toBe(1);
    expect(holds('engineRelease()')).toBe(1);
    expect(holds('standaloneReturned()')).toBe(1);
    fake.calls.length = 0;
    fake.store.getState().setBpm(BPM);
    expect(fake.store.getState().tap(START_MS).locked).toBe(true);
    expect(fake.calls.slice(0, 3)).toEqual([
      'yieldStandalone()',
      'engineHold()',
      call('metronomeSelectSlot', PLAY_ALONG),
    ]);
    expect(fake.anchors()).toHaveLength(1);
    stop();
  });

  it('rolls the slot back when the engine cannot be read', () => {
    const fake = fakePlayAlong({
      sessions: [],
      nowFrame: () => {
        throw new Error(NO_HOST);
      },
    });
    expect(() => {
      fake.store.getState().startClick();
    }).toThrow(NO_HOST);
    expect(fake.store.getState().clickPlaying).toBe(false);
    expect(fake.calls.slice(-3)).toEqual([
      call('metronomeSelectSlot', STANDALONE),
      'standaloneReturned()',
      'engineRelease()',
    ]);
  });

  it('stops when the screen stops watching', () => {
    const fake = clickAlone();
    fake.store.getState().watchLibrary()();
    expect(fake.store.getState().clickPlaying).toBe(false);
  });
});

describe('the tempo on a track change', () => {
  const NEXT = snapshot({ title: 'Next song' });

  it('looks up the new track and clears the old tempo when it has none', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.ladder.tempo(BPM);
    expect(fake.store.getState().bpm).toBe(BPM);
    fake.report([NEXT]);
    expect(fake.ladder.lookUp).toHaveBeenLastCalledWith({
      title: 'Next song',
      artist: 'Band',
    });
    expect(fake.store.getState().bpm).toBeUndefined();
    stop();
  });

  it('takes the tempo the ladder finds for the new track', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.report([NEXT]);
    fake.ladder.tempo(TAPPED_BPM);
    expect(fake.store.getState().bpm).toBe(TAPPED_BPM);
    stop();
  });

  it('shows no tempo once watched while a song has none yet', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    expect(fake.store.getState().bpm).toBeUndefined();
    stop();
  });

  it('keeps a typed tempo when the app reports the same track paused', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.store.getState().setBpm(TYPED_BPM);
    fake.report([snapshot({ playing: false })]);
    expect(fake.store.getState().bpm).toBe(TYPED_BPM);
    stop();
  });

  it('keeps a typed tempo over a found one across a report', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.ladder.tempo(FOUND_BPM);
    fake.store.getState().setBpm(TYPED_BPM);
    fake.report([snapshot({ positionMs: 20_000 })]);
    expect(fake.store.getState().bpm).toBe(TYPED_BPM);
    stop();
  });

  it('hands a typed tempo to the tempo ladder, its one owner', () => {
    const fake = fakePlayAlong();
    fake.store.getState().setBpm(TYPED_BPM);
    expect(fake.ladder.ladder.getState().bpm).toBe(TYPED_BPM);
  });

  it('keeps a tempo typed while locked once the lock ends on the same track', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.ladder.tempo(FOUND_BPM);
    fake.store.getState().tap(START_MS);
    fake.store.getState().setBpm(TYPED_BPM);
    fake.store.getState().unlock();
    fake.report([snapshot({ playing: false })]);
    expect(fake.store.getState().bpm).toBe(TYPED_BPM);
    stop();
  });

  it('clears the tempo for an untitled next track', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.ladder.tempo(FOUND_BPM);
    fake.report([snapshot({ title: null })]);
    expect(fake.store.getState().bpm).toBeUndefined();
    stop();
  });

  it('ignores a ladder tempo for another song', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.ladder.ladder.setState({ track: { title: 'Other', artist: 'Band' } });
    fake.ladder.tempo(FOUND_BPM);
    expect(fake.store.getState().bpm).toBeUndefined();
    stop();
  });

  it('never moves a locked tempo from the ladder', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.store.getState().setBpm(BPM);
    fake.store.getState().tap(START_MS);
    fake.ladder.tempo(FOUND_BPM + TYPED_BPM);
    expect(fake.store.getState().lock?.bpm).toBe(BPM);
    expect(fake.store.getState().bpm).toBe(BPM);
    stop();
  });

  it('falls back to the default tempo once no song is left', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    fake.report([]);
    expect(fake.store.getState().bpm).toBe(DEFAULT_BPM);
    stop();
  });
});
