import type { AppStateStatus } from 'react-native';
import { describe, expect, it } from 'vitest';

import { attachRig, type AppStateSource } from './rigClickLifecycle.ts';

function harness() {
  let listener: ((state: AppStateStatus) => void) | undefined;
  let removed = 0;
  const appState: AppStateSource = {
    addEventListener: (_type, next) => {
      listener = next;
      return {
        remove: () => {
          removed += 1;
        },
      };
    },
  };
  const counts = { stops: 0, holds: 0, releases: 0 };
  const detach = attachRig(
    {
      stop: () => {
        counts.stops += 1;
      },
    },
    () => {
      counts.holds += 1;
      return () => {
        counts.releases += 1;
      };
    },
    appState,
  );
  return {
    detach,
    appState: (state: AppStateStatus) => listener?.(state),
    counts,
    removed: () => removed,
  };
}

describe('rig lifecycle', () => {
  it('holds the engine while Rig is in focus', () => {
    const rig = harness();
    expect(rig.counts.holds).toBe(1);
    expect(rig.counts.releases).toBe(0);
  });

  it('stops the click and releases the engine on blur or unmount', () => {
    const rig = harness();
    rig.detach();
    expect(rig.counts.stops).toBe(1);
    expect(rig.counts.releases).toBe(1);
    expect(rig.removed()).toBe(1);
  });

  it('stops and releases in the background, and holds again on return', () => {
    const rig = harness();
    rig.appState('background');
    expect(rig.counts).toEqual({ stops: 1, holds: 1, releases: 1 });
    rig.appState('active');
    expect(rig.counts.holds).toBe(2);
    rig.detach();
    expect(rig.counts.releases).toBe(2);
  });

  it('keeps playing and holding through an inactive blip', () => {
    const rig = harness();
    rig.appState('inactive');
    rig.appState('active');
    expect(rig.counts).toEqual({ stops: 0, holds: 1, releases: 0 });
  });
});
