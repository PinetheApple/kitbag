import {
  EDIT_ROW_CONTROL_GAP,
  neighbourGaps,
  space,
  type NeighbourGaps,
} from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { songPreset } from '../../logic/fixtures.test-helper.ts';
import { draftFrom } from '../../logic/presetDraft.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const tracks = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    Pressable: (props: Props) => h('div', null, props.children),
  };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const passThrough = (props: Props) => h('div', null, props.children);
  return {
    ...(await original<Record<string, unknown>>()),
    EditGroup: passThrough,
    EditRow: passThrough,
    EditValue: passThrough,
    StepControl: () => null,
    SegmentedControl: (props: Props) => {
      tracks.push(props);
      return null;
    },
  };
});

vi.mock('../../screen/SoundSheet.tsx', () => ({
  SoundPickerSheet: () => null,
}));

const { RigGroup } = await import('./RigGroup.tsx');

const PRESET = songPreset({
  barMuteEnabled: true,
  barMutePlayBars: 2,
  barMuteMuteBars: 2,
});

function verticalGaps(): Record<string, NeighbourGaps> {
  tracks.length = 0;
  const editor = {
    draft: draftFrom(PRESET),
    dirty: false,
    update: vi.fn(),
    save: vi.fn(),
  };
  renderToStaticMarkup(createElement(RigGroup, { editor, bottomInset: 0 }));
  return Object.fromEntries(
    tracks.map((track) => {
      const gaps = neighbourGaps(
        track.neighbourGapDp as number | NeighbourGaps,
      );
      return [
        String(track.accessibilityLabel),
        { top: gaps.top, bottom: gaps.bottom },
      ];
    }),
  );
}

describe('preset editor rig tracks', () => {
  it('reach into the edit row padding around them', () => {
    const gaps = verticalGaps();
    const rowRoom = { top: EDIT_ROW_CONTROL_GAP, bottom: EDIT_ROW_CONTROL_GAP };
    expect(gaps['Count-in']).toEqual(rowRoom);
    expect(gaps['Tempo ramp']).toEqual(rowRoom);
    expect(gaps['Loop back at end']).toEqual(rowRoom);
    expect(gaps['Mute bars']).toEqual(rowRoom);
  });

  it('share the gap above the ramp unit with the stepper it wraps under', () => {
    expect(verticalGaps()['Ramp interval unit']).toEqual({
      top: space.controlGap,
      bottom: EDIT_ROW_CONTROL_GAP,
    });
  });
});
