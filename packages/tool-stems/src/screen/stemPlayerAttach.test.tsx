import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StemPlayerScreen } from './StemPlayerScreen.tsx';

const SET_ID = 7;
const INSETS = { top: 0, bottom: 0 };

const spies = vi.hoisted(() => ({
  bars: 8,
  effects: [] as (() => (() => void) | undefined)[],
  release: vi.fn(),
  attach: vi.fn(),
  close: vi.fn(),
}));

vi.mock('react', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useEffect: (effect: () => (() => void) | undefined) => {
    spies.effects.push(effect);
  },
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: { readonly children?: ReactNode }) =>
    h('div', null, props.children);
  return { Text: box, View: box };
});

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
      attach: spies.attach,
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
    spies.attach.mockReset().mockReturnValue(spies.release);
    spies.close.mockReset();
  });

  it('lets go through its own attachment, never a bare close', () => {
    renderToStaticMarkup(
      createElement(StemPlayerScreen, {
        setId: SET_ID,
        insets: INSETS,
        onBack: nothing,
      }),
    );
    const cleanups = spies.effects.map((effect) => effect());
    expect(spies.attach).toHaveBeenCalledWith(SET_ID, spies.bars);
    cleanups.forEach((cleanup) => cleanup?.());
    expect(spies.release).toHaveBeenCalledOnce();
    expect(spies.close).not.toHaveBeenCalled();
  });
});
