import { customSoundId } from '@kitbag/core-native';
import type { ClickSound, ClickSoundStore } from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SOUND_ROLE } from '../logic/soundChoice.ts';
import type { CustomSoundMenu } from './CustomSoundSheets.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const buttons = vi.hoisted(() => [] as Props[]);

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
  };
});

const { CustomSoundSheets } = await import('./CustomSoundSheets.tsx');

const RIMSHOT: ClickSound = {
  slot: 1,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
  fileName: 'a.wav',
};
const RIM_ID = customSoundId(RIMSHOT.slot);

function menu(kind: CustomSoundMenu['kind']): CustomSoundMenu {
  return {
    kind,
    target: RIMSHOT,
    open: vi.fn(),
    openRename: vi.fn(),
    openRemove: vi.fn(),
    close: vi.fn(),
  };
}

function draw(shown: CustomSoundMenu, onRemoved = vi.fn()) {
  buttons.length = 0;
  const html = renderToStaticMarkup(
    createElement(CustomSoundSheets, {
      menu: shown,
      bottomInset: 0,
      rolesUsing: () => [SOUND_ROLE.accent],
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

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(store.state, { remove, importPicked });
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
  it('names the roles it frees and removes the slot on confirm', async () => {
    const onRemoved = vi.fn();
    const { html, press } = draw(menu('remove'), onRemoved);
    expect(html).toContain('Remove “Rimshot”?');
    expect(html).toContain('Accent beats go back to Tick');
    press('Remove');
    expect(remove).toHaveBeenCalledExactlyOnceWith(RIMSHOT.slot);
    await vi.waitFor(() => {
      expect(onRemoved).toHaveBeenCalledExactlyOnceWith(RIM_ID);
    });
  });

  it('removes nothing on cancel', () => {
    const shown = menu('remove');
    draw(shown).press('Cancel');
    expect(shown.close).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });
});
