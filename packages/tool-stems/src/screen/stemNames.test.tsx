import { textRoles } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SharedValue } from 'react-native-reanimated';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const NAMES = ['guitar', 'vocals', 'other'];
const MASTER = 'Master';
const TWO_TIMES = 2;

const display = vi.hoisted(() => ({ fontScale: 1 }));
const texts = vi.hoisted(() => [] as Props[]);
const views = vi.hoisted(() => [] as Props[]);
const fits = vi.hoisted(() => [] as Record<string, unknown>[]);
const onAvailableLayout = vi.hoisted(() => () => undefined);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    BackHandler: { addEventListener: () => ({ remove: () => undefined }) },
    Pressable: box,
    ScrollView: box,
    Text: (props: Props) => {
      texts.push(props);
      return h('span', null, props.children);
    },
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () =>
    new Proxy({}, { get: (_, key) => ({ styleName: key }) }),
  useOneLineFit: (options: Record<string, unknown>) => {
    fits.push(options);
    return { style: {}, onAvailableLayout, measurer: null };
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

function renderAt(fontScale: number) {
  display.fontScale = fontScale;
  renderToStaticMarkup(
    createElement(StemList, { progress: {} as SharedValue<number> }),
  );
}

function textOf(name: string): Props | undefined {
  return texts.find((text) => text.children === name);
}

describe('stem list names', () => {
  beforeEach(() => {
    texts.length = 0;
    views.length = 0;
    fits.length = 0;
  });

  it.each([MASTER, ...NAMES])('holds %s to one tail-ellipsized line', (name) => {
    renderAt(TWO_TIMES);
    expect(textOf(name)).toMatchObject({
      numberOfLines: 1,
      ellipsizeMode: 'tail',
    });
  });

  it.each([MASTER, ...NAMES])(
    'floors %s at its design size while the text is scaled',
    (name) => {
      renderAt(TWO_TIMES);
      const fit = fits.find((options) => options.text === name);
      expect(fit?.role).toBe(textRoles.stemName);
      expect(Number(fit?.floor) * TWO_TIMES).toBeCloseTo(
        textRoles.stemName.size,
      );
    },
  );

  it.each([MASTER, ...NAMES])('never shrinks %s at the default scale', (name) => {
    renderAt(1);
    const fit = fits.find((options) => options.text === name);
    expect(fit?.floor).toBe(textRoles.stemName.size);
  });

  it('fits Master to the width the row leaves it', () => {
    renderAt(TWO_TIMES);
    const measured = views.filter((view) => view.onLayout === onAvailableLayout);
    expect(measured.at(-1)?.style).toEqual({ styleName: 'grow' });
    expect(measured).toHaveLength(NAMES.length + 1);
  });
});
