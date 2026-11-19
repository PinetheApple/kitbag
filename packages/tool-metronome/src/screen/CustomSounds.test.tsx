import { customSoundId } from '@kitbag/core-native';
import type { ClickSound, ClickSoundStore } from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const drawn = vi.hoisted(() => ({
  tiles: [] as Props[],
  options: [] as Props[],
  buttons: [] as Props[],
  cards: [] as Props[],
}));

const store = vi.hoisted(() => {
  const state: Partial<ClickSoundStore> = {};
  return { state };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useClickSounds: <T,>(select: (state: Partial<ClickSoundStore>) => T) =>
    select(store.state),
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const passThrough = (props: Props) => h('div', null, props.children);
  return {
    View: passThrough,
    Text: passThrough,
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const record = (list: Props[]) => (props: Props) => {
    list.push(props);
    return h('div', null, props.children);
  };
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    textStyle: () => ({}),
    useTextScaled: () => false,
    PickerTile: record(drawn.tiles),
    BarIconButton: record(drawn.options),
    Button: record(drawn.buttons),
    Card: record(drawn.cards),
    LinearProgress: () => null,
    SectionHeader: (props: Props) => h('h2', null, props.label as string),
    SheetHint: (props: Props) => h('p', null, props.children),
  };
});

const { CustomSounds } = await import('./CustomSounds.tsx');

const FORMATS = ['WAV', 'MP3', 'FLAC', 'AIFF'];
const RIMSHOT: ClickSound = {
  slot: 0,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
  fileName: 'a.wav',
};
const KICK: ClickSound = {
  ...RIMSHOT,
  slot: 1,
  uuid: '7f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Kick 22in',
};

const onPick = vi.fn();
const onImported = vi.fn();
const onOptions = vi.fn();

function draw(selected = 0): string {
  drawn.tiles.length = 0;
  drawn.options.length = 0;
  drawn.buttons.length = 0;
  drawn.cards.length = 0;
  return renderToStaticMarkup(
    createElement(CustomSounds, {
      selected,
      showHint: true,
      onPick,
      onImported,
      onOptions,
    }),
  );
}

const importButton = () =>
  drawn.buttons.find((button) => button.label === 'Import a sound');

beforeEach(() => {
  vi.clearAllMocks();
  store.state = {
    sounds: [],
    unavailable: [],
    preparing: null,
    notice: null,
    formats: FORMATS,
  };
});

describe('the Your sounds block', () => {
  it('offers an import and the formats while no sound is kept', () => {
    const html = draw();
    expect(html).toContain('Your sounds');
    expect(importButton()).toBeDefined();
    expect(html).toContain(
      'WAV, MP3, FLAC or AIFF, up to 2 seconds. You can keep two sounds.',
    );
    expect(drawn.tiles).toEqual([]);
  });

  it('shows each kept sound as a tile with its options, and no import once full', () => {
    Object.assign(store.state, { sounds: [RIMSHOT, KICK] });
    const html = draw(customSoundId(KICK.slot));
    expect(drawn.tiles.map((tile) => tile.accessibilityLabel)).toEqual([
      'Rimshot, your sound',
      'Kick 22in, your sound',
    ]);
    expect(drawn.tiles.map((tile) => tile.selected)).toEqual([false, true]);
    expect(drawn.options.map((button) => button.label)).toEqual([
      'Options for Rimshot',
      'Options for Kick 22in',
    ]);
    expect(importButton()).toBeUndefined();
    expect(html).toContain(
      'You can keep two sounds. Replace or remove one to import another.',
    );
  });

  it('picks a tile by its sound id and opens its options', () => {
    Object.assign(store.state, { sounds: [RIMSHOT] });
    draw();
    (drawn.tiles[0]?.onPress as () => void)();
    (drawn.options[0]?.onPress as () => void)();
    expect(onPick).toHaveBeenCalledExactlyOnceWith(customSoundId(RIMSHOT.slot));
    expect(onOptions).toHaveBeenCalledExactlyOnceWith(RIMSHOT);
  });

  it('swaps the import for a preparing card while a file is prepared', () => {
    Object.assign(store.state, { preparing: 'Rimshot.wav' });
    const html = draw();
    expect(html).toContain('Preparing “Rimshot.wav”…');
    expect(importButton()).toBeUndefined();
  });

  it('shows a refused file in a dismissable card', () => {
    const dismissNotice = vi.fn();
    Object.assign(store.state, {
      dismissNotice,
      notice: {
        kind: 'refused',
        fileName: 'Room tone.wav',
        replacing: null,
        problem: { kind: 'silent' },
      },
    });
    const html = draw();
    expect(html).toContain('“Room tone.wav” is silent, so it was not added.');
    expect(drawn.cards[0]).toMatchObject({ emphasis: 'warning' });
    const dismiss = drawn.buttons.find((button) => button.label === 'Dismiss');
    (dismiss?.onPress as () => void)();
    expect(dismissNotice).toHaveBeenCalledOnce();
  });

  it('never presents an unloadable sound as playing', () => {
    Object.assign(store.state, { sounds: [RIMSHOT], unavailable: [0] });
    const html = draw(customSoundId(RIMSHOT.slot));
    expect(drawn.tiles[0]).toMatchObject({
      accessibilityLabel: 'Rimshot, your sound, unavailable',
      selected: false,
      disabled: true,
    });
    expect(html).toContain(
      '“Rimshot” could not be loaded, so it plays as Tick. Replace it or remove it.',
    );
    expect(drawn.options).toHaveLength(1);
  });

  it('locks the tiles and their options while a file is prepared', () => {
    store.state = { ...store.state, sounds: [RIMSHOT], preparing: 'Hat.wav' };
    draw();
    expect(drawn.tiles[0]).toMatchObject({ disabled: true });
    expect(drawn.options[0]).toMatchObject({ disabled: true });
  });

  it('hands the imported sound’s id to the sheet', async () => {
    const importPicked = vi.fn(() => Promise.resolve(KICK));
    Object.assign(store.state, { importPicked });
    draw();
    (importButton()?.onPress as () => void)();
    await vi.waitFor(() => {
      expect(onImported).toHaveBeenCalledExactlyOnceWith(
        customSoundId(KICK.slot),
      );
    });
    expect(importPicked).toHaveBeenCalledExactlyOnceWith(null);
  });
});
