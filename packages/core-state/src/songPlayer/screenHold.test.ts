import { describe, expect, it, vi } from 'vitest';

import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { screenHold } from '../stemPlayer/screenHold.ts';
import { createStemPlayerStore } from '../stemPlayer/store.ts';
import { fakeRuntime, record, stem } from '../stemPlayer/store.test-helper.ts';
import { BARS, fakeSongRuntime, songStore } from './store.test-helper.ts';

const LOWER_ID = 3;
const UPPER_ID = 7;

function mixerScreens() {
  const claim = createMixerClaim();
  const songFake = fakeSongRuntime();
  const stemFake = fakeRuntime(record([stem(1)]));
  const songs = songStore(songFake, claim);
  const stems = createStemPlayerStore(() => stemFake.runtime, {
    mixerClaim: claim,
  });
  return {
    song: (id: number) => ({
      acquire: () => songs.getState().open(id, BARS).hold,
      shown: () => songs.getState(),
      opened: () => songs.getState().songId,
      fake: songFake,
    }),
    stem: (id: number) => ({
      acquire: () => stems.getState().acquireSong(id, BARS),
      shown: () => stems.getState(),
      opened: () => stems.getState().setId,
      fake: stemFake,
    }),
  };
}

type Kind = 'song' | 'stem';

interface ShownScreen {
  readonly shown: () => { readonly status: string };
  readonly opened: () => number | null;
}

const PAIRS: readonly (readonly [Kind, Kind])[] = [
  ['song', 'song'],
  ['song', 'stem'],
  ['stem', 'song'],
  ['stem', 'stem'],
];

function ready(screen: ShownScreen, id: number) {
  return vi.waitFor(() => {
    expect(screen.shown().status).toBe('ready');
    expect(screen.opened()).toBe(id);
  });
}

async function stack(lowerKind: Kind, upperKind: Kind) {
  const screens = mixerScreens();
  const lower = screens[lowerKind](LOWER_ID);
  const upper = screens[upperKind](UPPER_ID);
  const lowerHold = screenHold();
  const upperHold = screenHold();
  lowerHold.ensureHeld(lower.acquire);
  await ready(lower, LOWER_ID);
  upperHold.ensureHeld(upper.acquire);
  await ready(upper, UPPER_ID);
  return { lower, upper, lowerHold, upperHold };
}

describe.each(PAIRS)(
  'a %s screen under a %s screen',
  (lowerKind, upperKind) => {
    it('reopens paused when it regains focus after the upper screen left', async () => {
      const { lower, upper, lowerHold, upperHold } = await stack(
        lowerKind,
        upperKind,
      );
      lower.fake.commands.mixerPlay.mockClear();
      upperHold.release();
      lowerHold.ensureHeld(lower.acquire);
      await ready(lower, LOWER_ID);
      expect(lower.fake.commands.mixerPlay).not.toHaveBeenCalled();
      if (upperKind !== lowerKind) expect(upper.opened()).toBeNull();
    });

    it('stays open when the upper screen unmounts after the refocus', async () => {
      const { lower, lowerHold, upperHold } = await stack(lowerKind, upperKind);
      lowerHold.ensureHeld(lower.acquire);
      await ready(lower, LOWER_ID);
      upperHold.release();
      await ready(lower, LOWER_ID);
      const { engineHold, engineRelease } = lower.fake.commands;
      expect(engineRelease).toHaveBeenCalledTimes(
        engineHold.mock.calls.length - 1,
      );
    });

    it('leaves the focused screen open when the unfocused one unmounts', async () => {
      const { upper, lowerHold } = await stack(lowerKind, upperKind);
      lowerHold.release();
      await ready(upper, UPPER_ID);
    });
  },
);

describe('a screen that kept its session', () => {
  it('does not reopen or restart when it regains focus', async () => {
    const lower = mixerScreens().stem(LOWER_ID);
    const hold = screenHold();
    hold.ensureHeld(lower.acquire);
    await ready(lower, LOWER_ID);
    const loads = lower.fake.commands.loadTrack.mock.calls.length;
    lower.fake.commands.mixerStop.mockClear();
    hold.ensureHeld(lower.acquire);
    expect(lower.fake.commands.loadTrack).toHaveBeenCalledTimes(loads);
    expect(lower.fake.commands.mixerStop).not.toHaveBeenCalled();
  });
});

describe('the last Back', () => {
  it.each(PAIRS)(
    'balances the engine holds: %s under %s',
    async (lowerKind, upperKind) => {
      const { lower, upper, lowerHold, upperHold } = await stack(
        lowerKind,
        upperKind,
      );
      upperHold.release();
      lowerHold.ensureHeld(lower.acquire);
      await ready(lower, LOWER_ID);
      lowerHold.release();
      expect(lower.opened()).toBeNull();
      for (const { commands } of [lower.fake, upper.fake])
        expect(commands.engineRelease).toHaveBeenCalledTimes(
          commands.engineHold.mock.calls.length,
        );
    },
  );
});

describe('a load that does not reach ready', () => {
  it('does not retry on refocus', async () => {
    const lower = mixerScreens().song(LOWER_ID);
    lower.fake.records.readSong.mockResolvedValue(undefined);
    const hold = screenHold();
    hold.ensureHeld(lower.acquire);
    await vi.waitFor(() => {
      expect(lower.shown().status).toBe('missing');
    });
    hold.ensureHeld(lower.acquire);
    expect(lower.fake.records.readSong).toHaveBeenCalledOnce();
  });
});
