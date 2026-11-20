// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { KB_ACCENT, KB_SOUND_NAMES } from '@kitbag/core-native';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SONG_CLICK_TEXT } from '../logic/clickChipText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const { KB_ACCENT_ACCENTED: ACC, KB_ACCENT_NORMAL: NOR } = KB_ACCENT;
const WOODBLOCK = KB_SOUND_NAMES.indexOf('woodblock');
const COWBELL = KB_SOUND_NAMES.indexOf('cowbell');
const BEEP = KB_SOUND_NAMES.indexOf('beep');
const TOM = KB_SOUND_NAMES.indexOf('tom');

const NO_CUSTOM_SOUNDS = vi.hoisted(() => ({ sounds: [], unavailable: [] }));

const song = vi.hoisted(() => ({
  state: {},
  setClickSounds: vi.fn(),
  cycleClickAccent: vi.fn(),
  setClickCountIn: vi.fn(),
  saveForSong: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-native', () => ({ View: 'View' }));

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => ({ value }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const host = (name: string) => (props: Props) => h(name, props);
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: (build: (theme: unknown) => unknown) => () =>
      build({ color: {}, accentInk: 'accent' }),
    Chip: host('Chip'),
    UnsavedDot: host('UnsavedDot'),
    ChipRow: host('ChipRow'),
    Button: host('Button'),
    SectionHeader: host('SectionHeader'),
    SheetHint: host('SheetHint'),
    SegmentedControl: host('SegmentedControl'),
    PickerGrid: host('PickerGrid'),
    BeatLedRow: host('BeatLedRow'),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', props) : null,
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongPlayer: (select: (state: unknown) => unknown) => select(song.state),
  useClickSounds: (select: (state: unknown) => unknown) =>
    select(NO_CUSTOM_SOUNDS),
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ sounds: { normal: COWBELL, accent: COWBELL }, accents: [] }),
}));

const { SongClickChips } = await import('./SongClickChips.tsx');
const { SongClickSheet, useSongClickSheet } =
  await import('./SongClickSheet.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function givenSong(
  settings: Record<string, unknown> = {},
  change: Record<string, unknown> = {},
) {
  song.state = {
    status: 'ready',
    analysisStatus: 'done',
    beats: [0, 1],
    clickSettings: {
      countInBars: 0,
      sounds: { normal: WOODBLOCK, accent: BEEP },
      accents: [ACC, NOR, NOR, NOR],
      dirty: false,
      ...settings,
    },
    setClickSounds: song.setClickSounds,
    cycleClickAccent: song.cycleClickAccent,
    setClickCountIn: song.setClickCountIn,
    saveForSong: song.saveForSong,
    ...change,
  };
}

function Harness() {
  const sheet = useSongClickSheet();
  return createElement(
    'Screen',
    null,
    createElement(SongClickChips, { onOpen: sheet.open }),
    createElement(SongClickSheet, {
      group: sheet.group,
      bottomInset: 0,
      onDismiss: sheet.close,
    }),
  );
}

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(Harness), {
      createNodeMock: (element) => ({
        label: (element.props as Props).accessibilityLabel,
      }),
    });
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

const chips = (tree: ReactTestRenderer) =>
  tree.root.findAllByType('Chip' as never);

function chip(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const found = chips(tree).find((c) => c.props.label === label);
  if (found === undefined) throw new Error(`no chip ${label}`);
  return found;
}

function press(target: ReactTestInstance) {
  act(() => {
    (target.props.onPress as () => void)();
  });
}

function sheet(tree: ReactTestRenderer) {
  return tree.root.findByType('Sheet' as never);
}

function focusedGroup(tree: ReactTestRenderer) {
  const ref = sheet(tree).props.initialFocusRef as {
    current: { label: string } | null;
  };
  return ref.current?.label;
}

function select(tree: ReactTestRenderer, type: string, label: string) {
  const control = tree.root
    .findAllByType(type as never)
    .find((c) => c.props.accessibilityLabel === label);
  if (control === undefined) throw new Error(`no ${type} ${label}`);
  return control;
}

beforeEach(() => {
  vi.clearAllMocks();
  givenSong();
});

describe('the song click chips', () => {
  it.each([
    ['Count-in', SONG_CLICK_TEXT.countIn],
    ['Click: Woodblock', SONG_CLICK_TEXT.sound],
    ['Accent 1', SONG_CLICK_TEXT.accents],
  ])('%s opens the sheet at its group', (label, group) => {
    const tree = mount();
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    press(chip(tree, label));
    expect(sheet(tree).props.title).toBe(SONG_CLICK_TEXT.title);
    expect(focusedGroup(tree)).toBe(group);
  });

  it("reads the song's click, not the standalone metronome's", () => {
    const labels = chips(mount()).map((c) => c.props.label as string);
    expect(labels).toEqual(['Count-in', 'Click: Woodblock', 'Accent 1']);
  });

  it('mutes and disables every chip while the song has no grid', () => {
    givenSong({}, { beats: [] });
    for (const c of chips(mount())) {
      expect(c.props.disabled).toBe(true);
      expect(c.props.muted).toBe(true);
      expect(c.props.active).toBe(false);
    }
  });

  it('keeps the chips live with a grid, Count-in alone muted', () => {
    const live = chips(mount());
    expect(live.map((c) => c.props.disabled as boolean)).toEqual([
      false,
      false,
      false,
    ]);
    expect(live.map((c) => c.props.muted as boolean)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('shows the unsaved dot only while the song click is dirty', () => {
    const unsaved = (tree: ReactTestRenderer) =>
      tree.root
        .findAllByType('View' as never)
        .filter((v) => v.props.accessibilityLabel === SONG_CLICK_TEXT.unsaved);
    expect(unsaved(mount())).toHaveLength(0);
    givenSong({ dirty: true });
    expect(unsaved(mount())).toHaveLength(1);
  });
});

describe('the Click for this song sheet', () => {
  function opened() {
    const tree = mount();
    press(chip(tree, 'Click: Woodblock'));
    return tree;
  }

  it('changes the normal sound live and keeps the accent sound', () => {
    const tree = opened();
    const grid = tree.root.findByType('PickerGrid' as never);
    expect(grid.props.selected).toBe(String(WOODBLOCK));
    act(() => {
      (grid.props.onSelect as (v: string) => void)(String(TOM));
    });
    expect(song.setClickSounds).toHaveBeenCalledWith(TOM, BEEP);
  });

  it('changes the accent sound once Accent is picked', () => {
    const tree = opened();
    act(() => {
      (
        select(tree, 'SegmentedControl', SONG_CLICK_TEXT.soundRole).props
          .onSelect as (v: string) => void
      )('accent');
    });
    const grid = tree.root.findByType('PickerGrid' as never);
    expect(grid.props.selected).toBe(String(BEEP));
    act(() => {
      (grid.props.onSelect as (v: string) => void)(String(TOM));
    });
    expect(song.setClickSounds).toHaveBeenCalledWith(WOODBLOCK, TOM);
  });

  it('cycles a beat live from its LED', () => {
    const tree = opened();
    const leds = tree.root.findByType('BeatLedRow' as never);
    expect(leds.props.states).toEqual([
      'accented',
      'normal',
      'normal',
      'normal',
    ]);
    act(() => {
      (leds.props.onPressBeat as (beat: number) => void)(2);
    });
    expect(song.cycleClickAccent).toHaveBeenCalledWith(2);
  });

  it("shows the song's count-in with every length muted", () => {
    givenSong({ countInBars: 1 });
    const tree = opened();
    const countIn = select(tree, 'SegmentedControl', SONG_CLICK_TEXT.countIn);
    expect(countIn.props.selected).toBe('1');
    expect(
      (countIn.props.options as { disabled: boolean }[]).every(
        (o) => o.disabled,
      ),
    ).toBe(true);
  });

  it("saves the song's click from Save for this song", () => {
    const save = opened().root.findByType('Button' as never);
    expect(save.props.label).toBe(SONG_CLICK_TEXT.save);
    expect(save.props.disabled).toBeUndefined();
    press(save);
    expect(song.saveForSong).toHaveBeenCalledOnce();
  });

  it('closes on dismiss', () => {
    const tree = opened();
    act(() => {
      (sheet(tree).props.onDismiss as () => void)();
    });
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  });
});
