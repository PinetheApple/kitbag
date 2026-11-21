// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { TEMPO_MODE, TEMPO_SOURCE } from '@kitbag/core-state';
import { act } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from './SongPlayerScreen.mount.test-helper.ts';
import {
  display,
  resetScreenState,
  songTempo,
} from './SongPlayerScreen.mocks.test-helper.ts';

vi.mock('./EndedSetlistSnackbar.tsx', () => ({
  EndedSetlistSnackbar: () => null,
}));
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

const FIT = {
  mode: TEMPO_MODE.follow,
  bpm: 121.5,
  anchor: 0.25,
  beatsPerBar: 4,
  source: TEMPO_SOURCE.analysed,
};

beforeEach(resetScreenState);

function openMenu(): ReactTestRenderer {
  const tree = mount();
  const [more] = tree.root.findByType('AppBar' as never).props
    .actions as readonly { onPress: () => void }[];
  act(() => {
    more?.onPress();
  });
  return tree;
}

const tempoRow = (tree: ReactTestRenderer) =>
  tree.root.findByType('TempoModeRow' as never);

function openTempoSheet() {
  const tree = openMenu();
  act(() => {
    (tempoRow(tree).props.onPress as () => void)();
  });
  return tree;
}

describe('the Tempo row in the song player menu', () => {
  it('names the grid in use for a song Kitbag fitted', () => {
    songTempo.tempo = FIT;
    songTempo.mode = TEMPO_MODE.follow;
    expect(tempoRow(openMenu()).props).toMatchObject({
      value: 'Follow the band',
      reason: null,
    });
  });

  it('waits for the beat while the song is analysed', () => {
    display.analysis = { analysisStatus: 'analyzing', beats: [] };
    expect(tempoRow(openMenu()).props.reason).toBe(
      'Available once the beat is found',
    );
  });

  it('waits for a new analysis on a song with no fit yet', () => {
    expect(tempoRow(openMenu()).props.reason).toBe(
      'Available once Kitbag analyses this song again.',
    );
  });
});

describe('the Tempo sheet in the song player', () => {
  it('opens from the row, closing the menu, with the fitted tempo', () => {
    songTempo.tempo = FIT;
    songTempo.mode = TEMPO_MODE.follow;
    const tree = openTempoSheet();
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(tree.root.findByType('TempoModeSheet' as never).props).toMatchObject(
      {
        selected: TEMPO_MODE.follow,
        constantLine: 'Constant: 121.5 BPM',
        hint: 'The beats Kitbag heard. The click and loop snapping speed up and slow down with the band.',
      },
    );
  });

  it('switches the song to the picked grid', () => {
    songTempo.tempo = FIT;
    songTempo.mode = TEMPO_MODE.follow;
    const sheet = openTempoSheet().root.findByType('TempoModeSheet' as never);
    act(() => {
      (sheet.props.onSelect as (mode: string) => void)(TEMPO_MODE.constant);
    });
    expect(songTempo.setTempoMode).toHaveBeenCalledWith(TEMPO_MODE.constant);
  });

  it('keeps Constant tempo out of reach when Kitbag found no steady tempo', () => {
    songTempo.tempo = { ...FIT, bpm: null, anchor: null };
    songTempo.mode = TEMPO_MODE.follow;
    const sheet = openTempoSheet().root.findByType('TempoModeSheet' as never);
    expect(sheet.props.constantLine).toBe(
      'Kitbag found no steady tempo in this song.',
    );
    expect(sheet.props.options).toEqual([
      expect.objectContaining({ value: TEMPO_MODE.constant, disabled: true }),
      expect.objectContaining({ value: TEMPO_MODE.follow }),
    ]);
  });
});
