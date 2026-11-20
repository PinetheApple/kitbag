import { afterEach, describe, expect, it } from 'vitest';

import { endListeningSession } from './listeningSession.ts';
import { cycleRepeat, REPEAT, repeatStore } from './repeat.ts';
import { closeDatabases, setup, stems } from './store.test-helper.ts';

afterEach(() => {
  closeDatabases();
  repeatStore.setState({ mode: REPEAT.off, played: [], restart: null });
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

describe('a queued song that plays', () => {
  it('is kept for the next round under Repeat all', async () => {
    const { order, a, b } = await setup();
    await order.getState().addToQueue(stems(a));
    await order.getState().addToQueue(stems(b));
    repeatStore.setState({ mode: REPEAT.all });
    await order.getState().playQueued(stems(a));
    await order.getState().playQueued(stems(b));
    expect(repeatStore.getState().played).toEqual([stems(a), stems(b)]);
  });

  it('plays once otherwise', async () => {
    const { order, a } = await setup();
    await order.getState().addToQueue(stems(a));
    await order.getState().playQueued(stems(a));
    expect(repeatStore.getState().played).toEqual([]);
    expect(order.getState().queue).toEqual([]);
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
