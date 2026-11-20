// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SONG_SPEED_TEXT } from '../logic/viewText.ts';
import { mount } from './SongPlayerScreen.mount.test-helper.ts';
import {
  display,
  OPEN_SONG,
  resetScreenState,
  transport,
} from './SongPlayerScreen.mocks.test-helper.ts';

vi.mock('react-native', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reactNativeMock(),
);

vi.mock('./SongClickChips.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).clickChipsMock(),
);

vi.mock('react-native-reanimated', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reanimatedMock(),
);

vi.mock('@kitbag/core-design', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreDesignMock(
    original,
  ),
);

vi.mock('@kitbag/core-state', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreStateMock(
    original,
  ),
);

beforeEach(resetScreenState);

describe('the transport', () => {
  function speedKey(tree: ReactTestRenderer) {
    return tree.root
      .findByType('PlayerTransport' as never)
      .findByType('TransportKey' as never);
  }

  function openSpeed(): ReactTestRenderer {
    const tree = mount();
    act(() => {
      (speedKey(tree).props.onPress as () => void)();
    });
    return tree;
  }

  const speedGroup = (tree: ReactTestRenderer) =>
    tree.root.findByType('SpeedGroup' as never);

  it('shows full speed on a plain, live key', () => {
    expect(speedKey(mount()).props).toMatchObject({
      text: '100%',
      selected: false,
      accessibilityLabel: 'Speed 100%',
    });
    expect(speedKey(mount()).props.muted).toBeUndefined();
  });

  it('accents the key while the song is slowed', () => {
    display.speed = 0.9;
    expect(speedKey(mount()).props).toMatchObject({
      text: '90%',
      selected: true,
    });
  });

  it('opens the speed sheet for this song with the song tempo', () => {
    const tree = openSpeed();
    const sheet = tree.root.findByType('Sheet' as never);
    expect(sheet.props.title).toBe(SONG_SPEED_TEXT.title);
    expect(speedGroup(tree).props).toMatchObject({
      value: '100%',
      accented: false,
      hint: 'Song 120 BPM',
    });
    expect(tree.root.findAllByType('Snackbar' as never)).toHaveLength(0);
  });

  it('names the tempo that plays and marks the preset at a slower speed', () => {
    display.speed = 0.9;
    const group = speedGroup(openSpeed());
    expect(group.props.hint).toBe('Song 120 BPM, plays at 108 BPM');
    expect(
      (group.props.presets as readonly { label: string; selected: boolean }[])
        .filter(({ selected }) => selected)
        .map(({ label }) => label),
    ).toEqual(['90%']);
  });

  it('says there is no BPM for a song without one', () => {
    display.song = { ...OPEN_SONG, bpm: null };
    expect(speedGroup(openSpeed()).props.hint).toBe(
      'No beat grid, so there is no BPM to show',
    );
  });

  it('sets a picked preset and a stepped speed', () => {
    const group = speedGroup(openSpeed());
    act(() => {
      (group.props.onPick as (speed: number) => void)(0.75);
      (group.props.onStep as (delta: number) => void)(-1);
    });
    expect(transport.setSpeed.mock.calls).toEqual([[0.75], [0.95]]);
  });
});

describe('the song tempo at a slower speed', () => {
  it('shows the tempo that plays in the app bar and on the lock card', () => {
    display.speed = 0.9;
    const tree = mount();
    expect(tree.root.findByType('Badge' as never).props.label).toBe('108 BPM');
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Text' &&
          node.props.children === '108 BPM · grid ready',
      ),
    ).toHaveLength(1);
  });
});
