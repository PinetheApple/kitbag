import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';
import { RETIME_PLAYBACK_RATE } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

import { pressHardwareBack } from '../testing/reactNativeHosts.ts';
import {
  CLOSE,
  DIALOG_TITLE,
  flush,
  LATER,
  mountTracked,
  NOT_SAVED,
  PAD,
  PLAIN_LYRICS,
  RESET,
  RETIME,
  retiming,
  SAVE,
  SONG_DETAILS,
  UNDO_TAP,
  unmountTracked,
  withTestId,
} from './playerHarness.test-helper.tsx';

const EARLIER = 'Shift all lines earlier';
const slowed = (line: string) => `${line} · playing at 0.75×`;

describe('opening retime', () => {
  it('takes over the screen and starts playback', async () => {
    const p = await retiming();
    expect(p.has('Retime lyrics')).toBe(true);
    expect(p.has(slowed('Line 1 of 3'))).toBe(true);
    expect(p.labelled('Lyrics')).toHaveLength(0);
    expect(p.labelled('Player menu')).toHaveLength(0);
    expect(p.commands.mixerPlay).toHaveBeenCalledOnce();
  });

  it('says it plays at 0.75× once the mixer slowed', async () => {
    const p = await retiming();
    await flush();
    expect(p.has(slowed('Line 1 of 3'))).toBe(true);
  });

  it('claims no speed when the mixer refused it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const player = await mountTracked(SONG_DETAILS);
    player.commands.mixerSetRate.mockResolvedValueOnce(KB_RESULT.KB_ERROR_BUSY);
    await player.press('Lyrics');
    await player.press(RETIME);
    await flush();
    expect(player.has('Line 1 of 3')).toBe(true);
    expect(player.texts().join(' ')).not.toMatch(/0\.75|×/);
    warn.mockRestore();
  });

  it('restores the speed when the screen goes away mid-retime', async () => {
    const p = await retiming();
    await flush();
    unmountTracked();
    await flush();
    expect(p.commands.mixerSetRate.mock.calls).toEqual([
      [RETIME_PLAYBACK_RATE],
      [KB_MIXER_UNITY_RATE],
    ]);
  });

  it('starts at the line playing now', async () => {
    const player = await mountTracked(SONG_DETAILS);
    await player.press('Lyrics');
    player.frames(3.6);
    await player.press(RETIME);
    expect(player.has(slowed('Line 2 of 3'))).toBe(true);
    expect(player.store.getState().retime).toMatchObject({ nextLine: 2 });
  });

  it('opens from tap along on a plain-only song', async () => {
    const player = await mountTracked({
      ...SONG_DETAILS,
      lyrics: PLAIN_LYRICS,
    });
    await player.press('Lyrics');
    await player.press('Tap along to sync');
    expect(player.has(slowed('Line 1 of 3'))).toBe(true);
    expect(player.has('First line')).toBe(true);
  });

  it('draws no bar beside the line to tap', async () => {
    const p = await retiming();
    const [row] = withTestId(p, 'retime-current');
    expect(row?.children.map((c) => (c as { type: string }).type)).toEqual([
      'Text',
    ]);
  });
});

describe('the tap pad', () => {
  it('takes the tap as the finger lands, once', async () => {
    const p = await retiming();
    p.engine.position = 44100 * 2;
    await p.touchDown(PAD);
    expect(p.has(slowed('Line 2 of 3'))).toBe(true);
    expect(p.has('0:02.0')).toBe(true);
    p.engine.position = 44100 * 2.5;
    await p.press(PAD);
    expect(p.has(slowed('Line 2 of 3'))).toBe(true);
  });

  it('takes a screen reader’s press with no touch', async () => {
    const p = await retiming();
    await p.press(PAD);
    expect(p.has(slowed('Line 2 of 3'))).toBe(true);
  });

  it('undoes the last tap', async () => {
    const p = await retiming();
    expect(p.byLabel(UNDO_TAP).props.disabled).toBe(true);
    await p.touchDown(PAD);
    expect(p.byLabel(UNDO_TAP).props.disabled).toBe(false);
    await p.press(UNDO_TAP);
    expect(p.has(slowed('Line 1 of 3'))).toBe(true);
    expect(p.store.getState().retime).toMatchObject({ taps: [] });
  });

  it('says when every line is tapped', async () => {
    const p = await retiming();
    for (const position of [1, 2, 3]) {
      p.engine.position = 44100 * position;
      await p.touchDown(PAD);
    }
    expect(p.has(slowed('All 3 lines tapped'))).toBe(true);
  });
});

describe('Shift all lines', () => {
  it('steps both ways and shows the signed amount', async () => {
    const p = await retiming();
    expect(p.has('0.00 s')).toBe(true);
    await p.press(LATER);
    expect(p.has('+0.10 s')).toBe(true);
    await p.press(EARLIER);
    await p.press(EARLIER);
    expect(p.has('−0.10 s')).toBe(true);
    expect(p.store.getState().retime).toMatchObject({ shiftSteps: -1 });
  });
});

describe('Save', () => {
  it('stores the times and leaves the mode', async () => {
    const p = await retiming();
    p.engine.position = 44100 * 2;
    await p.touchDown(PAD);
    await p.press(SAVE);
    expect(p.records.saveLyricsRetimed).toHaveBeenCalledOnce();
    expect(p.records.saveLyricsRetimed.mock.calls[0]?.[0]).toBe(7);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.labelled(CLOSE)).toHaveLength(0);
    expect(p.has('Two')).toBe(true);
  });

  it('stays with the taps and shows the failure when the store refuses', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await retiming();
    p.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    await p.touchDown(PAD);
    await p.press(SAVE);
    expect(p.store.getState().retime.kind).toBe('recording');
    expect(p.store.getState().retimeFailure).toBe('notStored');
    expect(p.has(NOT_SAVED)).toBe(true);
    expect(p.has(slowed('Line 2 of 3'))).toBe(true);
    warn.mockRestore();
  });

  it('clears the failure on the retry that works', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await retiming();
    p.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    await p.touchDown(PAD);
    await p.press(SAVE);
    await p.press(SAVE);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.has(NOT_SAVED)).toBe(false);
    warn.mockRestore();
  });
});

describe('Reset', () => {
  async function opened() {
    const p = await retiming({
      ...SONG_DETAILS,
      lyricsRetimed: [2, 3, 4, 6],
    });
    await p.press(RESET);
    return p;
  }

  it('asks first, in the drawn words', async () => {
    const p = await opened();
    expect(p.has(DIALOG_TITLE)).toBe(true);
    expect(
      p.has(
        'Your taps and offset for this song are dropped. Lyrics go back to the timing that came in the bundle.',
      ),
    ).toBe(true);
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
  });

  it('does nothing on Cancel', async () => {
    const p = await opened();
    await p.press('Cancel');
    expect(p.has(DIALOG_TITLE)).toBe(false);
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
    expect(p.store.getState().retime.kind).toBe('recording');
  });

  it('closes only itself on the back gesture', async () => {
    const p = await opened();
    expect(pressHardwareBack()).toBe(true);
    expect(p.has(DIALOG_TITLE)).toBe(false);
    expect(p.store.getState().retime.kind).toBe('recording');
  });

  it('clears the stored timing and leaves on Reset', async () => {
    const p = await opened();
    await p.press('Reset');
    expect(p.records.saveLyricsRetimed).toHaveBeenCalledWith(7, null);
    expect(p.store.getState().lyrics.retimed).toBe(false);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.has(DIALOG_TITLE)).toBe(false);
  });

  it('stays in retime with the failure when the reset is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await opened();
    p.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    await p.press('Reset');
    expect(p.store.getState().retime.kind).toBe('recording');
    expect(p.has(NOT_SAVED)).toBe(true);
    expect(p.has(DIALOG_TITLE)).toBe(false);
    warn.mockRestore();
  });

  it('is off with nothing to reset', async () => {
    const p = await retiming();
    expect(p.byLabel(RESET).props.disabled).toBe(true);
    await p.touchDown(PAD);
    expect(p.byLabel(RESET).props.disabled).toBe(false);
  });
});
