import { useFocusedMixerHold, type MixerHold } from '@kitbag/core-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mountSurface } from './playerHarness.test-helper.tsx';

function fakeHold() {
  const hold = { release: vi.fn(), live: vi.fn(() => true) };
  return hold satisfies MixerHold;
}

function Probe({
  focused,
  acquire,
}: {
  readonly focused: boolean;
  readonly acquire: () => MixerHold;
}) {
  useFocusedMixerHold(focused, acquire);
  return null;
}

let hold = fakeHold();
const acquire = vi.fn(() => hold);

const probe = (focused: boolean, using: () => MixerHold = acquire) => (
  <Probe focused={focused} acquire={using} />
);

beforeEach(() => {
  hold = fakeHold();
  acquire.mockClear();
});

describe('holding the mixer while focused', () => {
  it('acquires when it mounts focused and releases on unmount', async () => {
    const surface = await mountSurface(probe(true));
    expect(acquire).toHaveBeenCalledOnce();
    surface.unmount();
    expect(hold.release).toHaveBeenCalledOnce();
  });

  it('does not acquire while it has never had focus', async () => {
    const surface = await mountSurface(probe(false));
    expect(acquire).not.toHaveBeenCalled();
    surface.update(probe(true));
    expect(acquire).toHaveBeenCalledOnce();
  });

  it('keeps its session through a blur', async () => {
    const surface = await mountSurface(probe(true));
    surface.update(probe(false));
    surface.update(probe(true));
    expect(hold.release).not.toHaveBeenCalled();
    expect(acquire).toHaveBeenCalledOnce();
  });

  it('acquires again on the refocus after its session was displaced', async () => {
    const surface = await mountSurface(probe(true));
    surface.update(probe(false));
    hold.live.mockReturnValue(false);
    expect(acquire).toHaveBeenCalledOnce();
    surface.update(probe(true));
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('releases the old song and acquires the new one on a song change', async () => {
    const surface = await mountSurface(probe(true));
    const newHold = fakeHold();
    const acquireNew = vi.fn(() => newHold);
    surface.update(probe(true, acquireNew));
    expect(hold.release).toHaveBeenCalledOnce();
    expect(acquireNew).toHaveBeenCalledOnce();
    expect(newHold.release).not.toHaveBeenCalled();
    surface.unmount();
    expect(newHold.release).toHaveBeenCalledOnce();
  });
});
