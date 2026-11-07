import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StemPlayerScreen } from './StemPlayerScreen.tsx';

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
  useEffect: (effect: () => (() => void) | undefined) => {
    spies.effects.push(effect);
  },
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () =>
    new Proxy({}, { get: (_, key) => ({ styleName: key }) }),
}));

vi.mock('@kitbag/core-state', () => ({
  secondsToFrames: () => 0,
  useStemPlayer: (select: (state: unknown) => unknown) =>
    select({
      status: 'loading',
      engineRate: 0,
      durationFrames: 0,
      loop: { kind: 'off' },
      retime: { kind: 'off' },
      acquireSong: spies.acquireSong,
      close: spies.close,
    }),
}));

const nothing = () => null;
vi.mock('./useMixerFrame.ts', () => ({ useMixerFrame: () => ({}) }));
vi.mock('./PlayerMenu.tsx', () => ({ PlayerMenu: () => nothing() }));
vi.mock('./StemAppBar.tsx', () => ({ StemAppBar: () => nothing() }));
vi.mock('./Scrubber.tsx', () => ({ Scrubber: () => nothing() }));
vi.mock('./SongFactChips.tsx', () => ({ SongFactChips: () => nothing() }));
vi.mock('./StemList.tsx', () => ({ StemList: () => nothing() }));
vi.mock('./StemTransport.tsx', () => ({ StemTransport: () => nothing() }));
vi.mock('./StemRowView.tsx', () => ({ WAVEFORM_BARS: spies.bars }));

describe('the stem player screen', () => {
  beforeEach(() => {
    spies.effects.length = 0;
    spies.release.mockReset();
    spies.acquireSong.mockReset().mockReturnValue(spies.release);
    spies.close.mockReset();
  });

  it('releases the song it acquired, never a bare close', () => {
    renderToStaticMarkup(
      createElement(StemPlayerScreen, {
        setId: SET_ID,
        insets: INSETS,
        onBack: nothing,
      }),
    );
    const cleanups = spies.effects.map((effect) => effect());
    expect(spies.acquireSong).toHaveBeenCalledWith(SET_ID, spies.bars);
    cleanups.forEach((cleanup) => cleanup?.());
    expect(spies.release).toHaveBeenCalledOnce();
    expect(spies.close).not.toHaveBeenCalled();
  });
});
