import { useFocusedMixerHold, type MixerHold } from '@kitbag/core-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mountSurface } from './playerHarness.test-helper.tsx';

function fakeHold(live: () => boolean): MixerHold & ReturnType<typeof vi.fn> {
  return Object.assign(vi.fn(), { live });
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

let live = true;
let hold = fakeHold(() => live);
const acquire = vi.fn(() => hold);

const probe = (focused: boolean) => (
  <Probe focused={focused} acquire={acquire} />
);

beforeEach(() => {
  live = true;
  hold = fakeHold(() => live);
  acquire.mockClear();
});

describe('holding the mixer while focused', () => {
  it('acquires when it mounts focused and releases on unmount', async () => {
    const surface = await mountSurface(probe(true));
    expect(acquire).toHaveBeenCalledOnce();
    surface.unmount();
    expect(hold).toHaveBeenCalledOnce();
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
    expect(hold).not.toHaveBeenCalled();
    expect(acquire).toHaveBeenCalledOnce();
  });

  it('acquires again on the refocus after its session was displaced', async () => {
    const surface = await mountSurface(probe(true));
    surface.update(probe(false));
    live = false;
    expect(acquire).toHaveBeenCalledOnce();
    surface.update(probe(true));
    expect(acquire).toHaveBeenCalledTimes(2);
  });
});
