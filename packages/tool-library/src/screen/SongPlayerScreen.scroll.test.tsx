// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { PLAYER_SCROLL_ID } from '@kitbag/core-design';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BODY_SLOT_ID, SONG_BODY_FLOOR } from './SongPlayerScreen.tsx';
import { mount } from './SongPlayerScreen.mount.test-helper.ts';
import { resetScreenState } from './SongPlayerScreen.mocks.test-helper.ts';

vi.mock('react-native', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reactNativeMock(),
);
vi.mock('./EndedSetlistSnackbar.tsx', () => ({
  EndedSetlistSnackbar: () => null,
}));
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

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.find(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
  );

const styleOf = (node: ReactTestInstance) =>
  Object.assign(
    {},
    ...([node.props.style].flat(Infinity) as object[]),
  ) as Record<string, unknown>;

describe('the song player below its app bar', () => {
  it('holds the body and the transport in one scroll', () => {
    const scroll = byTestId(mount(), PLAYER_SCROLL_ID);
    expect(scroll.findAllByType('PlayerTransport' as never)).toHaveLength(1);
    expect(
      scroll.findAll((node) => node.props.testID === BODY_SLOT_ID),
    ).not.toEqual([]);
  });

  it('keeps the body floor of one waveform card', () => {
    const slot = styleOf(byTestId(mount(), BODY_SLOT_ID));
    expect(slot.flexShrink).toBe(0);
    expect(slot.flexBasis).toBe(SONG_BODY_FLOOR);
  });
});
