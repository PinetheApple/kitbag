import { Sheet } from '@kitbag/core-design';
import { CLICK_RATE } from '@kitbag/core-state';
import { afterEach, describe, expect, it } from 'vitest';

import {
  mountTracked,
  unmountTracked,
  type Player,
} from './playerHarness.test-helper.tsx';

const MENU = 'Player menu';
const GROUPING_OFF = 'Click grouping, Off';
const RATE_SINGLE = 'Click rate, ×1';
const BEAT_SECONDS = 0.5;
const SEVEN_BEAT_SONG = {
  beats: Array.from({ length: 22 }, (_, i) => i * BEAT_SECONDS),
  bars: [{ beat: 0, beatsPerBar: 7 }],
};

let player: Player | undefined;

afterEach(() => {
  player?.store.getState().close();
  player = undefined;
  unmountTracked();
});

function startNodeLabel(p: Player): unknown {
  const [sheet] = p.renderer.root
    .findAllByType(Sheet)
    .filter((node) => node.props.title === 'Click for this song');
  const start = sheet?.props.initialFocusRef as
    | { current: { element: { props: { accessibilityLabel?: string } } } }
    | undefined;
  return start?.current.element.props.accessibilityLabel;
}

async function openClickSheet(change = SEVEN_BEAT_SONG) {
  const p = await mountTracked(change);
  player = p;
  await p.press(MENU);
  await p.press(GROUPING_OFF);
  return p;
}

describe('the click rows in the Player sheet', () => {
  it('sit between Reset mix and Export mix with the saved values', async () => {
    const p = await mountTracked(SEVEN_BEAT_SONG);
    player = p;
    await p.press(MENU);
    const texts = p.texts();
    const order = ['Reset mix', 'Click grouping', 'Click rate', 'Export mix'];
    const at = order.map((text) => texts.indexOf(text));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(p.byLabel(RATE_SINGLE).props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('are disabled with a reason when the song has no beat grid', async () => {
    const p = await mountTracked({ beats: [], bars: [] });
    player = p;
    await p.press(MENU);
    const row = p.byLabel('Click grouping, Needs a beat grid.');
    expect(row.props.accessibilityState).toEqual({ disabled: true });
    expect(p.labelled('Click rate, Needs a beat grid.')).toHaveLength(1);
  });

  it('are disabled when the grid has no bar marks', async () => {
    const p = await mountTracked({ ...SEVEN_BEAT_SONG, bars: [] });
    player = p;
    await p.press(MENU);
    const reason = "Needs bar marks. This song's grid has none.";
    const row = p.byLabel(`Click grouping, ${reason}`);
    expect(row.props.accessibilityState).toEqual({ disabled: true });
    expect(p.labelled(`Click rate, ${reason}`)).toHaveLength(1);
  });
});

describe('the click sheet', () => {
  it('offers the 7-beat presets and saves a pick for this song', async () => {
    const p = await openClickSheet();
    expect(p.has('Click for this song')).toBe(true);
    for (const preset of ['3+2+2', '2+2+3', '2+3+2'])
      expect(p.labelled(preset)).toHaveLength(1);
    await p.press('2+2+3');
    expect(p.records.saveStemSetClick).toHaveBeenLastCalledWith(7, {
      clickGrouping: [2, 2, 3],
    });
    expect(p.store.getState().clickGrouping).toEqual([2, 2, 3]);
  });

  it('saves the rate picked', async () => {
    const p = await openClickSheet();
    await p.press('×2');
    expect(p.records.saveStemSetClick).toHaveBeenLastCalledWith(7, {
      clickRate: CLICK_RATE.double,
    });
    expect(p.has('A click on every beat and one halfway between.')).toBe(true);
  });

  it('builds a custom grouping a group at a time', async () => {
    const p = await openClickSheet();
    await p.press('Custom');
    await p.press('Add a group of 3');
    await p.press('Add a group of 2');
    expect(p.store.getState().clickGrouping).toEqual([3, 2]);
    expect(
      p.has(
        'Add 2 more beats to fill a 7-beat bar. Until then every bar keeps only its first-beat accent.',
      ),
    ).toBe(true);
    await p.press('Remove the last group');
    expect(p.store.getState().clickGrouping).toEqual([3]);
  });

  it('starts reader focus on the Rate heading when opened from Click rate', async () => {
    const p = await mountTracked(SEVEN_BEAT_SONG);
    player = p;
    await p.press(MENU);
    await p.press(RATE_SINGLE);
    expect(startNodeLabel(p)).toBe('Rate');
  });

  it('leaves reader focus on the title when opened from Click grouping', async () => {
    const p = await openClickSheet();
    expect(startNodeLabel(p)).toBeUndefined();
  });

  it('shows the saved values on the rows once closed', async () => {
    const p = await openClickSheet();
    await p.press('3+2+2');
    await p.press('×1/2');
    await p.press('Done');
    await p.press(MENU);
    expect(p.labelled('Click grouping, 3+2+2')).toHaveLength(1);
    expect(p.labelled('Click rate, ×1/2')).toHaveLength(1);
  });
});
