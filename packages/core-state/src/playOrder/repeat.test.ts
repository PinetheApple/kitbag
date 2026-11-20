import { afterEach, describe, expect, it, vi } from 'vitest';

import { endListeningSession } from './listeningSession.ts';
import {
  configureRepeatAllHintPersistence,
  cycleRepeat,
  markRepeatAllHintSeen,
  notePlayedQueued,
  REPEAT,
  repeatStore,
} from './repeat.ts';

const stems = (id: number) => ({ kind: 'stems', id }) as const;

afterEach(() => {
  repeatStore.setState({
    mode: REPEAT.off,
    played: [],
    restart: null,
    allHintSeen: false,
  });
});

describe('the repeat chip', () => {
  it('cycles Repeat off, Repeat all, Repeat one and back', () => {
    const modes = [repeatStore.getState().mode];
    for (let press = 0; press < 3; press++) {
      cycleRepeat();
      modes.push(repeatStore.getState().mode);
    }
    expect(modes).toEqual([REPEAT.off, REPEAT.all, REPEAT.one, REPEAT.off]);
  });

  it('starts a fresh round on every change', () => {
    repeatStore.setState({
      mode: REPEAT.all,
      played: [stems(1)],
      restart: { setlistId: 1, from: null },
    });
    cycleRepeat();
    expect(repeatStore.getState()).toMatchObject({ played: [], restart: null });
  });
});

describe('a song played from the queue', () => {
  it('is kept once, in the order played, under Repeat all', () => {
    repeatStore.setState({ mode: REPEAT.all });
    notePlayedQueued(stems(1));
    notePlayedQueued(stems(2));
    notePlayedQueued(stems(1));
    expect(repeatStore.getState().played).toEqual([stems(2), stems(1)]);
  });

  it('is not kept otherwise', () => {
    notePlayedQueued(stems(1));
    expect(repeatStore.getState().played).toEqual([]);
  });
});

describe('Stop', () => {
  it('ends the round but keeps the repeat mode for the next song', () => {
    repeatStore.setState({
      mode: REPEAT.all,
      played: [stems(1)],
      restart: { setlistId: 1, from: null },
    });
    endListeningSession();
    expect(repeatStore.getState()).toMatchObject({
      mode: REPEAT.all,
      played: [],
      restart: null,
    });
  });
});

describe('the Repeat all hint', () => {
  it('saves the seen flag once', () => {
    const save = vi.fn();
    configureRepeatAllHintPersistence({ load: () => false, save });
    markRepeatAllHintSeen();
    markRepeatAllHintSeen();
    expect(save).toHaveBeenCalledTimes(1);
    expect(repeatStore.getState().allHintSeen).toBe(true);
  });

  it('stays seen after a restart that loads the saved flag', () => {
    configureRepeatAllHintPersistence({ load: () => true, save: vi.fn() });
    expect(repeatStore.getState().allHintSeen).toBe(true);
  });
});
