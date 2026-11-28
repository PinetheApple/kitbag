import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const seen = vi.hoisted(() => ({
  block: null as Props | null,
}));
const picker = vi.hoisted(() => ({ pick: () => undefined }));
const metro = vi.hoisted(() => {
  const setSounds: (normal: number, accent: number) => void = () => undefined;
  return {
    state: {
      sounds: { normal: 1, accent: 4 },
      setSounds,
      previewSound: () => undefined,
    },
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useMetronome: <T,>(select: (state: typeof metro.state) => T) =>
    select(metro.state),
  metronomeStore: { getState: () => metro.state },
  useSoundPicker: () => ({
    role: 'normal',
    setRole: () => undefined,
    pick: picker.pick,
  }),
}));

vi.mock('react-native', () => ({}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    Sheet: (props: Props) => h('section', null, props.children),
    SoundPickerSheet: (props: Props) => h('section', null, props.children),
    PickerGrid: () => null,
    SegmentedControl: () => null,
    Icon: () => null,
    TransportKey: () => null,
    hitBoxStyle: () => ({}),
    hitExtension: () => ({}),
    textStyle: () => ({}),
    unshared: (gap: number) => gap,
  };
});

vi.mock('./CustomSounds.tsx', () => ({
  CustomSounds: (props: Props) => {
    seen.block = props;
    return null;
  },
  useCustomSoundViews: () => [],
  useImportHint: () => '',
}));
vi.mock('./CustomSoundSheets.tsx', () => ({
  CustomSoundSheets: () => null,
  useCustomSoundMenu: () => ({ open: () => undefined }),
  useRemovedSoundNotice: () => undefined,
}));
vi.mock('./PracticeSection.tsx', () => ({
  PracticeSection: () => null,
  usePracticeStyles: () => ({}),
}));

const { MetronomeSoundSheet } = await import('./SoundSheet.tsx');
const { SoundListSheet } = await import('./PracticeSound.tsx');

const IMPORTED = 7;

const imported = () => seen.block?.onImported as (id: number) => void;

beforeEach(() => {
  seen.block = null;
  metro.state.sounds = { normal: 1, accent: 4 };
});

describe('a sound imported while the other role changes', () => {
  it('is picked for the role being edited in the song editor', () => {
    renderToStaticMarkup(
      createElement(MetronomeSoundSheet, {
        visible: true,
        bottomInset: 0,
        onDismiss: () => undefined,
        sounds: { normal: 1, accent: 4 },
        onChange: vi.fn(),
      }),
    );
    expect(imported()).toBe(picker.pick);
  });

  it('keeps the other role on the metronome', () => {
    const setSounds = vi.fn();
    metro.state.setSounds = setSounds;
    renderToStaticMarkup(
      createElement(SoundListSheet, {
        role: 'accent',
        bottomInset: 0,
        onDismiss: () => undefined,
      }),
    );
    metro.state.sounds = { normal: 3, accent: 4 };
    imported()(IMPORTED);
    expect(setSounds).toHaveBeenCalledExactlyOnceWith(3, IMPORTED);
  });
});
