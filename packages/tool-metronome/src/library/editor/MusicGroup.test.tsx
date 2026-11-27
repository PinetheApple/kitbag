import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { songPreset } from '../../logic/fixtures.test-helper.ts';
import { DEFAULT_BPM } from '@kitbag/core-state';

import {
  draftFrom,
  editFrom,
  type PresetDraft,
} from '../../logic/presetDraft.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const rows = vi.hoisted(() => [] as Props[]);
const steppers = vi.hoisted(() => [] as Props[]);
const display = vi.hoisted(() => ({ scaled: false }));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const passThrough = (props: Props) => h('div', null, props.children);
  return {
    ...(await original<Record<string, unknown>>()),
    EditGroup: passThrough,
    EditRow: (props: Props) => {
      rows.push(props);
      return passThrough(props);
    },
    EditTextInput: () => null,
    SegmentedControl: () => null,
    StepControl: (props: Props) => {
      steppers.push(props);
      return null;
    },
    useTextScaled: () => display.scaled,
  };
});

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => ({ value }),
}));
vi.mock('../../screen/BeatLeds.tsx', () => ({ BeatLeds: () => null }));

const { IdentityGroup, MusicGroup } = await import('./MusicGroup.tsx');

function editorFor(draft: PresetDraft) {
  return { draft, dirty: false, update: vi.fn(), save: vi.fn() };
}

function singleLineByLabel(scaled: boolean): Record<string, unknown> {
  display.scaled = scaled;
  rows.length = 0;
  const editor = {
    draft: draftFrom(songPreset()),
    dirty: false,
    update: vi.fn(),
    save: vi.fn(),
  };
  renderToStaticMarkup(createElement(IdentityGroup, { editor }));
  return Object.fromEntries(
    rows.map((row): [string, unknown] => [String(row.label), row.singleLine]),
  );
}

describe('preset editor identity rows', () => {
  it('keep the name and notes inputs beside their labels at the default text size', () => {
    expect(singleLineByLabel(false)).toEqual({ Name: true, Notes: true });
  });

  it('let the inputs take their own line once the text grows', () => {
    expect(singleLineByLabel(true)).toEqual({ Name: false, Notes: false });
  });
});

function tempoField(draft: PresetDraft): Props | undefined {
  steppers.length = 0;
  renderToStaticMarkup(createElement(MusicGroup, { editor: editorFor(draft) }));
  return steppers.find((props) => props.label === 'Tempo');
}

describe('preset editor tempo row', () => {
  const untimed = draftFrom(songPreset({ bpm: null }));

  it('shows the song’s tempo for a song that saves none', () => {
    expect(tempoField(untimed)).toMatchObject({
      wrapValue: true,
      value: 'Tempo from the song',
      accessibilityValue: 'Tempo from the song',
    });
  });

  it('leaves the song’s tempo on any step, even back to the same number', () => {
    let draft = untimed;
    const update = (change: (d: PresetDraft) => PresetDraft) => {
      draft = change(draft);
    };
    const stepTempo = (delta: number) => {
      steppers.length = 0;
      const editor = { ...editorFor(draft), update };
      renderToStaticMarkup(createElement(MusicGroup, { editor }));
      const field = steppers.find((props) => props.label === 'Tempo');
      (field?.onStep as (delta: number) => void)(delta);
    };
    stepTempo(1);
    stepTempo(-1);
    expect(editFrom(draft).bpm).toBe(DEFAULT_BPM);
    expect(tempoField(draft)).toMatchObject({
      value: String(DEFAULT_BPM),
      accessibilityValue: `${String(DEFAULT_BPM)} BPM`,
    });
  });

  it('shows a saved tempo as before', () => {
    expect(tempoField(draftFrom(songPreset({ bpm: 96 })))).toMatchObject({
      value: '96',
      accessibilityValue: '96 BPM',
    });
  });
});
