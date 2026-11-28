import { customSoundId } from '@kitbag/core-native';
import type {
  ClickSound,
  ClickSoundStore,
  SoundsUpdate,
} from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomSoundMenu } from './CustomSoundSheets.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const buttons = vi.hoisted(() => [] as Props[]);
const snackbars = vi.hoisted(() => [] as Props[]);

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
  return { View: (props: Props) => h('div', null, props.children) };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    Sheet: (props: Props) =>
      props.visible === true
        ? h(
            'section',
            null,
            h('h1', null, props.title as string),
            props.children,
          )
        : null,
    SheetHint: (props: Props) => h('p', null, props.children),
    TextField: () => null,
    Button: (props: Props) => {
      buttons.push(props);
      return null;
    },
    TimedSnackbar: (props: Props) => {
      snackbars.push(props);
      return h('output', null, props.message as string);
    },
  };
});

const { CustomSoundSheets, useRemovedSoundNotice } =
  await import('./CustomSoundSheets.tsx');

const RIMSHOT: ClickSound = {
  slot: 1,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
  fileName: 'a.wav',
};
const RIM_ID = customSoundId(RIMSHOT.slot);

function menu(
  kind: CustomSoundMenu['kind'],
  removedFrom: CustomSoundMenu['removedFrom'] = null,
): CustomSoundMenu {
  return {
    kind,
    target: RIMSHOT,
    removedFrom,
    open: vi.fn(),
    openRename: vi.fn(),
    close: vi.fn(),
    setRemovedFrom: vi.fn(),
  };
}

function draw(shown: CustomSoundMenu, onRemoved = vi.fn()) {
  buttons.length = 0;
  const html = renderToStaticMarkup(
    createElement(CustomSoundSheets, {
      menu: shown,
      bottomInset: 0,
      sounds: { normal: 1, accent: RIM_ID },
      onRemoved,
    }),
  );
  const press = (label: string) => {
    const button = buttons.find((candidate) => candidate.label === label);
    (button?.onPress as () => void)();
  };
  return { html, press };
}

const remove = vi.fn(() => Promise.resolve(0));
const importPicked = vi.fn(() => Promise.resolve(null));
const undoRemove = vi.fn(() => Promise.resolve(true));
const dismissRemoved = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(store.state, {
    remove,
    importPicked,
    undoRemove,
    dismissRemoved,
    removed: null,
  });
});

describe('the sound options', () => {
  it('offers rename, replace and remove under the sound’s name', () => {
    const { html } = draw(menu('options'));
    expect(html).toContain('<h1>Rimshot</h1>');
    expect(buttons.map((button) => button.label)).toEqual([
      'Rename',
      'Replace',
      'Remove sound',
    ]);
    expect(html).toContain(
      'Replace keeps the new sound on every beat and song that uses Rimshot.',
    );
  });

  it('replaces into the sound’s own slot', () => {
    const shown = menu('options');
    draw(shown).press('Replace');
    expect(shown.close).toHaveBeenCalledOnce();
    expect(importPicked).toHaveBeenCalledExactlyOnceWith(RIMSHOT);
  });
});

describe('removing a sound', () => {
  it('removes at once from the options, keeping the sounds it was on', async () => {
    const onRemoved = vi.fn();
    const shown = menu('options');
    draw(shown, onRemoved).press('Remove sound');
    expect(shown.close).toHaveBeenCalledOnce();
    expect(shown.setRemovedFrom).toHaveBeenCalledWith({
      normal: 1,
      accent: RIM_ID,
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith(RIMSHOT.slot);
    await vi.waitFor(() => {
      expect(onRemoved).toHaveBeenCalledExactlyOnceWith(RIM_ID);
    });
  });
});

function Notice(props: {
  readonly menu: CustomSoundMenu;
  readonly onRestored: (update: SoundsUpdate) => void;
}) {
  return useRemovedSoundNotice(props.menu, props.onRestored);
}

describe('the Undo snackbar over the sound sheet', () => {
  it('offers Undo and puts the sound back on the beats it left', async () => {
    Object.assign(store.state, {
      removed: {
        sound: RIMSHOT,
        resets: [],
        released: { metronome: null, standalone: null },
        at: Date.now(),
      },
    });
    const onRestored = vi.fn();
    snackbars.length = 0;
    const html = renderToStaticMarkup(
      createElement(Notice, {
        menu: menu('none', { normal: 1, accent: RIM_ID }),
        onRestored,
      }),
    );
    expect(html).toContain('Removed “Rimshot”');
    const [bar] = snackbars;
    expect(bar).toMatchObject({ inline: true, actionLabel: 'Undo' });
    (bar?.onAction as () => void)();
    await vi.waitFor(() => {
      expect(onRestored).toHaveBeenCalledOnce();
    });
    expect(undoRemove).toHaveBeenCalledOnce();
    const [update] = onRestored.mock.calls[0] as [SoundsUpdate];
    expect(update({ normal: 1, accent: 4 })).toEqual({
      normal: 1,
      accent: RIM_ID,
    });
  });
});
