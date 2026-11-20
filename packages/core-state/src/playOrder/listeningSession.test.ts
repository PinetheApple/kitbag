import { describe, expect, it, vi } from 'vitest';

import type { QueuedSong } from '@kitbag/core-db';

import {
  endSessionOnCardStop,
  recordHeardSongs,
  stopSongAndSession,
  type ListeningDeps,
} from './listeningSession.ts';

function deps() {
  const stops: (() => void)[] = [];
  const cardStop = (listener: () => void) => {
    stops.push(listener);
    return () => {
      stops.splice(stops.indexOf(listener), 1);
    };
  };
  const wiring = {
    cardStops: [cardStop, cardStop],
    closePlayers: vi.fn(),
    endSession: vi.fn(),
  } satisfies ListeningDeps;
  const pressStop = (index: number) => {
    stops[index]?.();
  };
  return { ...wiring, pressStop, listening: () => stops.length };
}

describe('the listening session', () => {
  it('ends with Stop on the mini-player, closing whichever song plays', () => {
    const wiring = deps();
    stopSongAndSession(wiring);
    expect(wiring.closePlayers).toHaveBeenCalledOnce();
    expect(wiring.endSession).toHaveBeenCalledOnce();
  });

  it.each([0, 1])('ends with Stop on either song card (%i)', (index) => {
    const wiring = deps();
    endSessionOnCardStop(wiring);
    wiring.pressStop(index);
    expect(wiring.endSession).toHaveBeenCalledOnce();
    expect(wiring.closePlayers).not.toHaveBeenCalled();
  });

  it('lets go of the cards once unsubscribed', () => {
    const wiring = deps();
    endSessionOnCardStop(wiring)();
    expect(wiring.listening()).toBe(0);
  });
});

describe('the songs heard in the listening session', () => {
  const NIGHT_BUS: QueuedSong = { kind: 'stems', id: 21 };
  const HUM: QueuedSong = { kind: 'song', id: 41 };

  function recording(first: QueuedSong | null) {
    let shown = first;
    let changed: () => void = () => undefined;
    const hear = vi.fn<(song: QueuedSong) => void>();
    recordHeardSongs({
      shown: () => shown,
      subscribe: (listener) => {
        changed = listener;
        return () => undefined;
      },
      hear,
    });
    const show = (song: QueuedSong | null) => {
      shown = song;
      changed();
    };
    return { hear, show };
  }

  it('hears each song as it shows, once while it stays', () => {
    const { hear, show } = recording(NIGHT_BUS);
    show(NIGHT_BUS);
    show(HUM);
    expect(hear.mock.calls).toEqual([[NIGHT_BUS], [HUM]]);
  });

  it('hears a song again when it shows after nothing played', () => {
    const { hear, show } = recording(HUM);
    show(null);
    show(HUM);
    expect(hear.mock.calls).toEqual([[HUM], [HUM]]);
  });
});
