// react-test-renderer is deprecated, but it alone renders hooks with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, useMemo } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BARS, SONG_ID } from '../songPlayer/store.test-helper.ts';
import { ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import { at } from '../stemPlayer/store.test-helper.ts';
import type { PlayerSource, SongSource } from './playerSource.ts';
import { OTHER, playing, twoSongs } from './songView.test-helper.ts';
import { SONG_KIND, useHeldFrame, useViewedSource } from './useViewedPlayer.ts';
import { startedSetlist } from './view.test-helper.ts';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const HELD_START = 1.5;
const NOT_PLAYING = OTHER + 1;

type Stores = Awaited<ReturnType<typeof playing>>;

interface Seen {
  source?: PlayerSource<SongSource>;
  held?: number | null;
}

function Probe({
  stores,
  id,
  seen,
}: {
  readonly stores: Stores;
  readonly id: number;
  readonly seen: Seen;
}) {
  const kind = useMemo(
    () => ({ ...SONG_KIND, live: stores.player, view: stores.view }),
    [stores],
  );
  seen.source = useViewedSource(kind, id, true, BARS);
  seen.held = useHeldFrame(stores.view, seen.source.viewing);
  return null;
}

let renderer: ReactTestRenderer | undefined;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function viewing(stores: Stores, seen: Seen) {
  await act(async () => {
    renderer = create(createElement(Probe, { stores, id: OTHER, seen }));
    await Promise.resolve();
  });
  await flush();
}

let stores: Stores;
const seen: Seen = {};

beforeEach(async () => {
  stores = await playing(twoSongs(), startedSetlist());
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

describe('the player source of a viewed song', () => {
  it('reads the view store and leaves the playing song alone', async () => {
    await viewing(stores, seen);
    expect(seen.source?.viewing).toBe(true);
    expect(seen.source?.store).toBe(stores.view);
    expect(stores.view.getState()).toMatchObject({
      status: 'ready',
      songId: OTHER,
    });
    expect(stores.player.getState().songId).toBe(SONG_ID);
  });

  it('shows the held start as the playhead', async () => {
    await viewing(stores, seen);
    act(() => {
      stores.view.getState().seek(at(HELD_START));
    });
    expect(seen.held).toBe(at(HELD_START));
  });

  it('turns live once Play starts the song', async () => {
    await viewing(stores, seen);
    let outcome: unknown;
    await act(async () => {
      outcome = await stores.view.getState().play();
    });
    expect(outcome).toBe(ADVANCE_OUTCOME.playing);
    expect(seen.source?.viewing).toBe(false);
    expect(seen.source?.store).toBe(stores.player);
    expect(seen.held).toBeNull();
    expect(stores.view.getState().status).toBe('idle');
  });

  it('turns live and lets the view go when the song plays from elsewhere', async () => {
    await viewing(stores, seen);
    await act(async () => {
      await stores.player.getState().open(OTHER, BARS).loaded;
    });
    expect(seen.source?.viewing).toBe(false);
    expect(stores.view.getState().status).toBe('idle');
  });

  it('stays live when the route moves to another song', async () => {
    await viewing(stores, seen);
    await act(async () => {
      renderer?.update(createElement(Probe, { stores, id: NOT_PLAYING, seen }));
      await Promise.resolve();
    });
    expect(seen.source?.viewing).toBe(false);
    expect(seen.source?.store).toBe(stores.player);
    expect(stores.view.getState().status).toBe('idle');
  });
});
