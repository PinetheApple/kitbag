import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StemPlayerScreen } from '@kitbag/tool-stems/src/screen/StemPlayerScreen.tsx';

const SET_ID = 7;
const INSETS = { top: 0, bottom: 0 };

const spies = vi.hoisted(() => ({
  bars: 8,
  effects: [] as (() => (() => void) | undefined)[],
  release: vi.fn(),
  acquireSong: vi.fn(),
  close: vi.fn(),
}));

vi.mock('react', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useLayoutEffect: (effect: () => (() => void) | undefined) => {
    spies.effects.push(effect);
  },
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () =>
    new Proxy({}, { get: (_, key) => ({ styleName: key }) }),
}));

vi.mock('@kitbag/core-state', async (original) => {
  const player = (select: (state: unknown) => unknown) =>
    select({
      status: 'loading',
      engineRate: 0,
      durationFrames: 0,
      loop: { kind: 'off' },
      retime: { kind: 'off' },
      acquireSong: spies.acquireSong,
      close: spies.close,
    });
  return {
    ...(await original<Record<string, unknown>>()),
    loopEndFrames: () => null,
    useStemPlayer: player,
    useLiveStemPlayer: player,
  };
});

const nothing = () => null;
vi.mock('@kitbag/tool-stems/src/screen/useMixerFrame.ts', () => ({
  useMixerFrame: () => ({}),
}));
vi.mock('@kitbag/tool-stems/src/screen/PlayerMenu.tsx', () => ({
  PlayerMenu: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/ExportSheet.tsx', () => ({
  ExportSheet: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/StemMeterSheet.tsx', () => ({
  StemMeterSheet: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/ClickSheet.tsx', () => ({
  ClickSheet: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/TempoSheet.tsx', () => ({
  TempoSheet: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/StemSetTempo.tsx', () => ({
  StemSetTempoSheet: () => nothing(),
  TempoUndoSnackbar: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/SpeedKeySheet.tsx', () => ({
  SpeedKeySheet: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/StemAppBar.tsx', () => ({
  StemAppBar: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/Scrubber.tsx', () => ({
  Scrubber: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/SongFactChips.tsx', () => ({
  SongFactChips: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/StemList.tsx', () => ({
  StemList: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/StemTransport.tsx', () => ({
  StemTransport: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/StemRowView.tsx', () => ({
  WAVEFORM_BARS: spies.bars,
}));
vi.mock('@kitbag/tool-stems/src/screen/QueueSheet.tsx', () => ({
  QueueSheet: () => nothing(),
}));
vi.mock('@kitbag/tool-stems/src/screen/usePlayOrderNav.ts', () => ({
  usePlayOrderNav: () => ({ skip: nothing }),
}));
vi.mock('@kitbag/tool-stems/src/screen/queueActions.tsx', () => ({
  SetlistSheet: () => nothing(),
  useQueueActions: () => ({
    presses: { playNext: nothing, addToQueue: nothing },
    added: nothing,
  }),
  useCarriedSkipNotice: () => nothing(),
}));

describe('the stem player screen', () => {
  beforeEach(() => {
    spies.effects.length = 0;
    spies.release.mockReset();
    spies.acquireSong
      .mockReset()
      .mockReturnValue({ release: spies.release, live: () => true });
    spies.close.mockReset();
  });

  it('releases the song it acquired, never a bare close', () => {
    renderToStaticMarkup(
      createElement(StemPlayerScreen, {
        setId: SET_ID,
        focused: true,
        insets: INSETS,
        onBack: nothing,
        onOpenStemSet: nothing,
        onOpenSong: nothing,
        onOpenMetronome: nothing,
        onOpenSetlist: nothing,
      }),
    );
    const cleanups = spies.effects.map((effect) => effect());
    expect(spies.acquireSong).toHaveBeenCalledWith(SET_ID, spies.bars);
    cleanups.forEach((cleanup) => cleanup?.());
    expect(spies.release).toHaveBeenCalledOnce();
    expect(spies.close).not.toHaveBeenCalled();
  });
});
