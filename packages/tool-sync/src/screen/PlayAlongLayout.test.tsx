// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { space, textRoles } from '@kitbag/core-design';
import { act, createElement, type ReactElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Style = Record<string, unknown>;

const BPM = 95;
const display = vi.hoisted(() => ({ scaled: false }));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Linking: { openURL: () => Promise.resolve() },
}));

vi.mock('@kitbag/core-design', async (original) => {
  const theme = {
    color: new Proxy({}, { get: (_, name) => String(name) }),
    accentInk: 'accent',
  };
  const pass = (props: Props) => props.children;
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: (factory: (t: typeof theme) => unknown) => () =>
      factory(theme),
    useTheme: () => theme,
    useTextScaled: () => display.scaled,
    textStyle: (role: { readonly size: number }) => ({ fontSize: role.size }),
    Card: pass,
    Badge: 'Badge',
    Button: 'Button',
    Icon: 'Icon',
    DrawnFigures: 'DrawnFigures',
    AppBar: 'AppBar',
    Chip: 'Chip',
    StatusPill: 'StatusPill',
    KeyBadge: 'KeyBadge',
    CHIP_HEIGHT: 0,
    libraryList: {},
    unshared: (gap: number) => gap,
  };
});

const { BpmCard } = await import('./BpmCard.tsx');
const { PermissionExplainer } = await import('./PermissionExplainer.tsx');
const { PlayAlongAppBar } = await import('./PlayAlongAppBar.tsx');

function mount(element: ReactElement): ReactTestInstance {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  if (tree === undefined) throw new Error('nothing rendered');
  return tree.root;
}

function flat(style: unknown): Style {
  if (Array.isArray(style))
    return Object.assign({}, ...style.map(flat)) as Style;
  return typeof style === 'object' && style !== null ? (style as Style) : {};
}

function bpmCard(): ReactTestInstance {
  return mount(
    createElement(BpmCard, {
      bpm: BPM,
      line: {
        lead: 'from ',
        rung: 'tap tempo',
        tail: '',
        noTempo: false,
        credit: null,
      },
      newTrack: false,
      onOpenTempo: vi.fn(),
    }),
  );
}

beforeEach(() => {
  display.scaled = false;
});

describe('the BPM card', () => {
  it('lays the numeral out with the Text that draws it, so the box grows with the font scale', () => {
    const root = bpmCard();
    const numeral = root.findByProps({ children: String(BPM) });
    expect(numeral.type).toBe('Text');
    const style = flat(numeral.props.style);
    expect(style.fontSize).toBe(textRoles.tempoNumeralTight.size);
    expect(style.height).toBeUndefined();
    expect(style.lineHeight).toBeUndefined();
    expect(root.findAllByType('DrawnFigures' as never)).toEqual([]);
  });

  it('puts the BPM line under the numeral above font 1.0', () => {
    display.scaled = true;
    const root = bpmCard();
    const side = root.findByProps({ children: 'BPM' }).parent?.parent;
    const top = root.findByType('Pressable' as never);
    expect(flat(side?.props.style).flexBasis).toBe('100%');
    expect(flat(top.props.style).flexWrap).toBe('wrap');
  });

  it('keeps the BPM line beside the numeral at font 1.0', () => {
    const side = bpmCard().findByProps({ children: 'BPM' }).parent?.parent;
    expect(flat(side?.props.style).flexBasis).toBeUndefined();
  });
});

describe('the access explainer', () => {
  it('insets its cards, buttons and hint by the screen inset', () => {
    const root = mount(
      createElement(PermissionExplainer, {
        stillOff: true,
        onOpenAccess: vi.fn(),
        onNotNow: vi.fn(),
      }),
    );
    const scroll = root.findByType('ScrollView' as never);
    expect(flat(scroll.props.contentContainerStyle).paddingHorizontal).toBe(
      space.screenInset,
    );
  });
});

describe('the source chip above font 1.0', () => {
  it('sits on its own line at the screen inset', () => {
    display.scaled = true;
    const root = mount(
      createElement(PlayAlongAppBar, {
        onBack: vi.fn(),
        onMenu: null,
        source: {
          appLabel: 'Spotify',
          count: 2,
          greyed: false,
          onPress: vi.fn(),
        },
      }),
    );
    let line = root.findByType('Chip' as never).parent;
    while (line !== null && flat(line.props.style).paddingBottom === undefined)
      line = line.parent;
    expect(flat(line?.props.style).paddingHorizontal).toBe(space.screenInset);
  });
});
