import { describe, expect, it, vi } from 'vitest';

import {
  endSessionOnCardStop,
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
