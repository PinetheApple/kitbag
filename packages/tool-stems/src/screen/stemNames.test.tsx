import { textRoles } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SharedValue } from 'react-native-reanimated';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const NAMES = ['guitar', 'vocals', 'other'];
const MASTER = 'Master';

const fitted = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    BackHandler: { addEventListener: () => ({ remove: () => undefined }) },
    Pressable: box,
    ScrollView: box,
    Text: box,
    View: box,
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () =>
    new Proxy({}, { get: (_, key) => ({ styleName: key }) }),
  DesignFloorOneLineText: (props: Props) => {
    fitted.push(props);
    return null;
  },
  Waveform: () => null,
}));

vi.mock('@kitbag/core-state', () => ({
  useStemPlayer: (select: (state: unknown) => unknown) =>
    select({
      stems: NAMES.map((name) => ({ name, loaded: true, muted: false })),
      masterGain: 1,
    }),
}));

vi.mock('./stemStyles.ts', () => ({
  useStemStyles: () => new Proxy({}, { get: () => ({}) }),
}));
vi.mock('./GainFader.tsx', () => ({ GainFader: () => null }));
vi.mock('./LevelChip.tsx', () => ({ LevelChip: () => null }));
vi.mock('./StemNameEditor.tsx', () => ({ StemNameEditor: () => null }));
vi.mock('./StemToggle.tsx', () => ({ StemToggle: () => null }));

const { StemList } = await import('./StemList.tsx');

function fitOf(name: string): Props | undefined {
  return fitted.find((props) => props.text === name);
}

describe('stem list names', () => {
  beforeEach(() => {
    fitted.length = 0;
    renderToStaticMarkup(
      createElement(StemList, { progress: {} as SharedValue<number> }),
    );
  });

  it.each([MASTER, ...NAMES])('fits %s in the stem name role', (name) => {
    expect(fitOf(name)?.role).toBe(textRoles.stemName);
  });

  it('fits Master to the width the row leaves it', () => {
    expect(fitOf(MASTER)?.boxStyle).toEqual({ styleName: 'grow' });
  });

  it.each(NAMES)('fits %s to the name column it sits in', (name) => {
    expect(fitOf(name)?.boxStyle).toBeUndefined();
  });
});
