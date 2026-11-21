import type { PerAccentSounds } from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHEET_TOUCH_ROOM } from '@kitbag/core-design';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Updater = (sounds: PerAccentSounds) => PerAccentSounds;

const seen = vi.hoisted(() => ({
  block: null as Props | null,
  roles: null as Props | null,
}));
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
}));

vi.mock('react-native', () => ({}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    Sheet: (props: Props) => h('section', null, props.children),
    PickerGrid: () => null,
    SegmentedControl: (props: Props) => {
      seen.roles = props;
      return null;
    },
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
}));
vi.mock('./useHoldEngine.ts', () => ({ useHoldEngine: () => undefined }));
vi.mock('./PracticeSection.tsx', () => ({
  PracticeSection: () => null,
  usePracticeStyles: () => ({}),
}));

const { SoundPickerSheet } = await import('./SoundSheet.tsx');
const { SoundListSheet } = await import('./PracticeSound.tsx');

const IMPORTED = 7;

const imported = () => seen.block?.onImported as (id: number) => void;

beforeEach(() => {
  seen.block = null;
  metro.state.sounds = { normal: 1, accent: 4 };
});

describe('a sound imported while the other role changes', () => {
  it('keeps the other role in the song editor', () => {
    const onChange = vi.fn<(update: Updater) => void>();
    renderToStaticMarkup(
      createElement(SoundPickerSheet, {
        visible: true,
        bottomInset: 0,
        onDismiss: () => undefined,
        sounds: { normal: 1, accent: 4 },
        onChange,
      }),
    );
    imported()(IMPORTED);
    const [update] = onChange.mock.calls[0] ?? [];
    expect(update?.({ normal: 1, accent: 2 })).toEqual({
      normal: IMPORTED,
      accent: 2,
    });
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

describe('the beat level control heading the sound sheet', () => {
  it('takes the room to the sheet edge above it whole', () => {
    renderToStaticMarkup(
      createElement(SoundPickerSheet, {
        visible: true,
        bottomInset: 0,
        onDismiss: () => undefined,
        sounds: { normal: 1, accent: 4 },
        onChange: vi.fn(),
      }),
    );
    expect(seen.roles?.edgeRoomDp).toEqual({ top: SHEET_TOUCH_ROOM });
    expect(
      (seen.roles?.neighbourGapDp as { top?: number }).top,
    ).toBeUndefined();
  });
});
