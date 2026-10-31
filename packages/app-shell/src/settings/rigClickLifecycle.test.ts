import type { AppStateStatus } from 'react-native';
import { describe, expect, it } from 'vitest';

import { attachRigClick, type AppStateSource } from './rigClickLifecycle.ts';

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
  let stops = 0;
  const detach = attachRigClick(
    {
      stop: () => {
        stops += 1;
      },
    },
    appState,
  );
  return {
    detach,
    appState: (state: AppStateStatus) => listener?.(state),
    stops: () => stops,
    removed: () => removed,
  };
}

describe('rig click lifecycle', () => {
  it('stops the click when Settings loses focus or unmounts', () => {
    const rig = harness();
    rig.detach();
    expect(rig.stops()).toBe(1);
    expect(rig.removed()).toBe(1);
  });

  it('stops the click when the app goes to the background', () => {
    const rig = harness();
    rig.appState('background');
    expect(rig.stops()).toBe(1);
  });

  it('keeps playing through an inactive blip', () => {
    const rig = harness();
    rig.appState('inactive');
    rig.appState('active');
    expect(rig.stops()).toBe(0);
  });
});
