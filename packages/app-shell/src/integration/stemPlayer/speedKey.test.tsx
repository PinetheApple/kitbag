import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import { resetValue, speedKeyCopy } from '@kitbag/core-state';
import { stem } from '@kitbag/core-state/src/stemPlayer/store.test-helper.ts';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { display } from '@kitbag/core-state/src/testing/reactNativeHosts.ts';
import {
  PlayerMenu,
  VALUE_STACKED_ID,
} from '@kitbag/tool-stems/src/screen/PlayerMenu.tsx';
import {
  PER_STEM_STACKED_ID,
  SpeedKeySheet,
} from '@kitbag/tool-stems/src/screen/SpeedKeySheet.tsx';
import { STACKED_ID } from '@kitbag/tool-stems/src/screen/StemKeyRows.tsx';
import {
  flush,
  mountPlayer,
  withTestId,
  RETIME,
  retiming,
  SONG_DETAILS,
  unmountTracked,
  type Player,
} from './playerHarness.test-helper.tsx';

const SPEED = 'Speed';
const SONG_KEY = 'Song key';
const MENU = 'Player menu';
const PER_STEM = 'Per-stem key';
const RESET = 'Reset speed and key: full speed, every stem at the recorded key';
const SONG = { ...SONG_DETAILS, bpm: 123, key: 'F', scale: 'major' };
const BAND = [
  stem(1, { name: 'vocals', role: 'vocals' }),
  stem(2, { name: 'drums', role: 'drums' }),
  stem(3, { name: 'bass', role: 'bass' }),
];

let player: Player | undefined;

afterEach(() => {
  display.fontScale = 1;
  player?.store.getState().close();
  player?.unmount();
  player = undefined;
  unmountTracked();
});

async function open(stems = BAND) {
  player = await mountPlayer(SONG, stems);
  return player;
}

async function act11y(p: Player, label: string, actionName: string, at = 0) {
  const target = p.labelled(label)[at];
  if (target === undefined) throw new Error(`no control labelled "${label}"`);
  await act(async () => {
    (target.props.onAccessibilityAction as (event: unknown) => void)({
      nativeEvent: { actionName },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const ratesSet = (p: Player) =>
  p.commands.mixerSetRate.mock.calls.map(([rate]) => rate);

async function openSheet(p: Player) {
  await act11y(p, SPEED, 'activate');
  return p;
}

describe('the speed and key line in the dock', () => {
  it('shows full speed and the recorded key', async () => {
    const p = await open();
    expect(p.byLabel(SPEED).props.accessibilityValue).toEqual({ text: '100%' });
    expect(p.byLabel(SONG_KEY).props.accessibilityValue).toEqual({
      text: 'as recorded',
    });
    expect(p.has('123')).toBe(true);
  });

  it('plays a speed step at once and shows the BPM that plays', async () => {
    const p = await open();
    await act11y(p, SPEED, 'decrement');
    expect(ratesSet(p)).toEqual([0.95]);
    expect(p.has('95%')).toBe(true);
    expect(p.has('117')).toBe(true);
  });

  it('moves the song key and shows the key that plays', async () => {
    const p = await open();
    await act11y(p, SONG_KEY, 'decrement');
    await act11y(p, SONG_KEY, 'decrement');
    expect(p.has('−2 st')).toBe(true);
    expect(p.has('E♭ maj')).toBe(true);
    expect(p.commands.mixerSetTrackPitch.mock.calls.at(-1)).toEqual([2, -2]);
  });

  it('is not shown while lyrics are retimed', async () => {
    const p = await retiming();
    expect(p.labelled(SPEED)).toHaveLength(0);
  });

  it('renders nothing per frame while playing slowed', async () => {
    const p = await open();
    await act11y(p, SPEED, 'decrement');
    p.frames(3.6);
    const listener = vi.fn();
    const stop = p.store.subscribe(listener);
    p.commit.mockClear();
    for (let i = 0; i < 60; i++) p.frames(3.6 + i / 400);
    expect(p.commit).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    stop();
  });
});

describe('the speed and key sheet', () => {
  it('opens from a stepper value with the song tempo and key', async () => {
    const p = await openSheet(await open());
    expect(p.has('Speed and key')).toBe(true);
    expect(p.has('Song 123 BPM')).toBe(true);
    expect(p.has('F maj. Drums and the click are never transposed.')).toBe(
      true,
    );
    expect(p.has('all follow the song')).toBe(true);
  });

  it('picks a preset speed and marks it', async () => {
    const p = await openSheet(await open());
    await p.press('Speed 75%');
    expect(ratesSet(p)).toEqual([0.75]);
    expect(p.has('Song 123 BPM, plays at 92 BPM')).toBe(true);
    expect(p.byLabel('Speed 75%').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('sets one stem apart, never offers drums a key, and restores it', async () => {
    const p = await openSheet(await open());
    await p.press(`${PER_STEM}, all follow the song`);
    expect(p.labelled('drums key')).toHaveLength(0);
    expect(p.has('not transposed')).toBe(true);
    await act11y(p, 'bass key', 'increment');
    expect(p.has('bass set apart')).toBe(true);
    expect(p.has('+1 st')).toBe(true);
    await p.press('Set bass back to the song key');
    expect(p.has('all follow the song')).toBe(true);
  });
});

const shownSheet = (
  p: Player,
  type: typeof SpeedKeySheet | typeof PlayerMenu,
) => p.renderer.root.findByType(type).props.visible as boolean;

describe('the speed and key sheet among the player sheets', () => {
  it('gives way when the player menu opens', async () => {
    const p = await openSheet(await open());
    expect(shownSheet(p, SpeedKeySheet)).toBe(true);
    await p.press(MENU);
    expect(shownSheet(p, SpeedKeySheet)).toBe(false);
    expect(shownSheet(p, PlayerMenu)).toBe(true);
  });

  it('closes through its exit when a retime starts', async () => {
    const p = await openSheet(await open());
    await p.press('Lyrics');
    await p.press(RETIME);
    expect(p.store.getState().retime.kind).toBe('recording');
    expect(shownSheet(p, SpeedKeySheet)).toBe(false);
  });
});

describe('resetting speed and key', () => {
  it('sets full speed and every key back from the player menu', async () => {
    const p = await open();
    await act11y(p, SPEED, 'decrement');
    await act11y(p, SONG_KEY, 'increment');
    await p.press(MENU);
    await p.press(RESET);
    await flush();
    expect(p.store.getState()).toMatchObject({
      speed: KB_MIXER_UNITY_RATE,
      songKey: 0,
    });
    expect(ratesSet(p).at(-1)).toBe(KB_MIXER_UNITY_RATE);
  });
});

describe('player menu values under font scale', () => {
  async function openMenuAt(fontScale: number) {
    display.fontScale = fontScale;
    const p = await open();
    await p.press(MENU);
    return p;
  }

  const textIn = (node: { findAll: Player['renderer']['root']['findAll'] }) =>
    node
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => n.props.children as unknown);

  it('keeps each value beside its label at the design size', async () => {
    const p = await openMenuAt(1);
    expect(withTestId(p, VALUE_STACKED_ID)).toEqual([]);
  });

  it('stacks each value under its label at 2.0', async () => {
    const p = await openMenuAt(2);
    const stacks = withTestId(p, VALUE_STACKED_ID).map(textIn);
    expect(stacks).toContainEqual([speedKeyCopy.reset, resetValue()]);
    expect(stacks).toContainEqual(['Reset mix', 'levels, mutes, solos']);
    expect(stacks.some(([label]) => label === 'Export mix')).toBe(true);
  });
});

describe('per-stem key rows under font scale', () => {
  async function openRows(fontScale: number) {
    display.fontScale = fontScale;
    const p = await openSheet(await open());
    await p.press(`${PER_STEM}, all follow the song`);
    return p;
  }

  const holds = (
    box: {
      findAll: (
        test: (n: { props: Record<string, unknown> }) => boolean,
      ) => unknown[];
    },
    text: string,
  ) => box.findAll((node) => node.props.children === text).length > 0;

  it('keeps name, status and stepper on one line at the design size', async () => {
    const p = await openRows(1);
    expect(withTestId(p, STACKED_ID)).toHaveLength(0);
    expect(withTestId(p, PER_STEM_STACKED_ID)).toHaveLength(0);
    expect(p.has('follows the song')).toBe(true);
  });

  it('stacks each status under its stem name and the summary under its label at 2.0', async () => {
    const p = await openRows(2);
    const stacks = withTestId(p, STACKED_ID);
    expect(stacks).toHaveLength(BAND.length);
    expect(
      stacks.every(
        (stack) =>
          holds(stack, 'follows the song') || holds(stack, 'not transposed'),
      ),
    ).toBe(true);
    const [header] = withTestId(p, PER_STEM_STACKED_ID);
    expect(header !== undefined && holds(header, 'all follow the song')).toBe(
      true,
    );
    expect(header !== undefined && holds(header, PER_STEM)).toBe(true);
  });
});
