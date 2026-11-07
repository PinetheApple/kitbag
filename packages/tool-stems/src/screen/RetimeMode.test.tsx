import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pressHardwareBack } from '../testing/reactNativeHosts.ts';
import {
  flush,
  mountPlayer,
  PLAIN_LYRICS,
  SONG_DETAILS,
  withTestId,
  type Player,
} from './playerHarness.test-helper.tsx';

const RETIME = 'Retime lyrics';
const PAD = 'Tap as this line starts';
const UNDO_TAP = 'Undo tap';
const LATER = 'Shift all lines later';
const EARLIER = 'Shift all lines earlier';
const RESET = 'Reset to bundle timing';
const CLOSE = 'Close retime';
const SAVE = 'Save';
const NOT_SAVED = 'Timing not saved. Your taps are still here, try again.';
const DIALOG_TITLE = 'Reset to bundle timing?';
const LEAVE_TITLE = 'Leave without saving?';
const LEAVE = 'Leave';
const KEEP_TAPPING = 'Keep tapping';

let player: Player | undefined;

async function retiming(change = SONG_DETAILS) {
  player = await mountPlayer(change);
  await player.press('Lyrics');
  await player.press(RETIME);
  return player;
}

afterEach(() => {
  player?.unmount();
  player = undefined;
});

describe('opening retime', () => {
  it('takes over the screen and starts playback', async () => {
    const p = await retiming();
    expect(p.has('Retime lyrics')).toBe(true);
    expect(p.has('Line 1 of 3')).toBe(true);
    expect(p.labelled('Lyrics')).toHaveLength(0);
    expect(p.labelled('Player menu')).toHaveLength(0);
    expect(p.commands.mixerPlay).toHaveBeenCalledOnce();
  });

  it('draws nothing of the 0.75x speed work (#299)', async () => {
    const p = await retiming();
    expect(p.texts().join(' ')).not.toMatch(/0\.75|×/);
  });

  it('starts at the line playing now', async () => {
    player = await mountPlayer(SONG_DETAILS);
    await player.press('Lyrics');
    player.frames(3.6);
    await player.press(RETIME);
    expect(player.has('Line 2 of 3')).toBe(true);
    expect(player.store.getState().retime).toMatchObject({ nextLine: 2 });
  });

  it('opens from tap along on a plain-only song', async () => {
    player = await mountPlayer({ ...SONG_DETAILS, lyrics: PLAIN_LYRICS });
    await player.press('Lyrics');
    await player.press('Tap along to sync');
    expect(player.has('Line 1 of 3')).toBe(true);
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
    expect(p.has('Line 2 of 3')).toBe(true);
    expect(p.has('0:02.0')).toBe(true);
    p.engine.position = 44100 * 2.5;
    await p.press(PAD);
    expect(p.has('Line 2 of 3')).toBe(true);
  });

  it('takes a screen reader’s press with no touch', async () => {
    const p = await retiming();
    await p.press(PAD);
    expect(p.has('Line 2 of 3')).toBe(true);
  });

  it('undoes the last tap', async () => {
    const p = await retiming();
    expect(p.byLabel(UNDO_TAP).props.disabled).toBe(true);
    await p.touchDown(PAD);
    expect(p.byLabel(UNDO_TAP).props.disabled).toBe(false);
    await p.press(UNDO_TAP);
    expect(p.has('Line 1 of 3')).toBe(true);
    expect(p.store.getState().retime).toMatchObject({ taps: [] });
  });

  it('says when every line is tapped', async () => {
    const p = await retiming();
    for (const position of [1, 2, 3]) {
      p.engine.position = 44100 * position;
      await p.touchDown(PAD);
    }
    expect(p.has('All 3 lines tapped')).toBe(true);
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
    expect(p.has('Line 2 of 3')).toBe(true);
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

describe('leaving', () => {
  it('leaves at once from Close with no taps and no shift', async () => {
    const p = await retiming();
    await p.press(CLOSE);
    expect(p.has(LEAVE_TITLE)).toBe(false);
    expect(p.store.getState().retime.kind).toBe('off');
  });

  it('leaves at once on Back with no taps and no shift', async () => {
    const p = await retiming();
    expect(pressHardwareBack()).toBe(true);
    expect(p.has(LEAVE_TITLE)).toBe(false);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.onBack).not.toHaveBeenCalled();
  });

  it('asks before Close drops a tap, in the drawn words', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    expect(p.has(LEAVE_TITLE)).toBe(true);
    expect(
      p.has(
        'Your 1 tap for this song is dropped. The lyrics keep their current timing.',
      ),
    ).toBe(true);
    expect(p.labelled(KEEP_TAPPING)).toHaveLength(1);
    expect(p.labelled(LEAVE)).toHaveLength(1);
    expect(p.store.getState().retime.kind).toBe('recording');
  });

  it('asks before Close drops a shift', async () => {
    const p = await retiming();
    await p.press(LATER);
    await p.press(CLOSE);
    expect(p.has(LEAVE_TITLE)).toBe(true);
    expect(p.store.getState().retime.kind).toBe('recording');
  });

  it('keeps the taps on Keep tapping', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    await p.press(KEEP_TAPPING);
    expect(p.has(LEAVE_TITLE)).toBe(false);
    expect(p.store.getState().retime).toMatchObject({
      kind: 'recording',
      taps: [expect.anything()],
    });
  });

  it('drops the session on Leave through leaveRetime, writing nothing', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    const { leaveRetime } = p.store.getState();
    const leave = vi.fn(leaveRetime);
    p.store.setState({ leaveRetime: leave });
    await p.press(LEAVE);
    p.store.setState({ leaveRetime });
    expect(leave).toHaveBeenCalledOnce();
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.has(LEAVE_TITLE)).toBe(false);
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
    expect(p.labelled(RETIME)).toHaveLength(1);
  });

  it('holds Back while a save runs, and a failed save still shows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await retiming();
    let refuse: (reason: Error) => void = () => undefined;
    p.records.saveLyricsRetimed.mockReturnValueOnce(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    await p.touchDown(PAD);
    await p.press(SAVE);
    expect(pressHardwareBack()).toBe(true);
    expect(p.store.getState().retime.kind).toBe('recording');
    refuse(new Error('disk'));
    await flush();
    expect(p.has(NOT_SAVED)).toBe(true);
    expect(p.store.getState().retime).toMatchObject({
      taps: [expect.anything()],
    });
    warn.mockRestore();
  });

  it('drops the reset dialog when a save ends the session under it', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(RESET);
    expect(p.has(DIALOG_TITLE)).toBe(true);
    await act(async () => {
      await p.store.getState().commitRetime();
    });
    await p.press(RETIME);
    expect(p.store.getState().retime.kind).toBe('recording');
    expect(p.has(DIALOG_TITLE)).toBe(false);
  });

  it('asks on the back gesture, and Back again keeps the taps', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    expect(pressHardwareBack()).toBe(true);
    expect(p.has(LEAVE_TITLE)).toBe(true);
    expect(p.store.getState().retime.kind).toBe('recording');
    expect(pressHardwareBack()).toBe(true);
    expect(p.has(LEAVE_TITLE)).toBe(false);
    expect(p.store.getState().retime.kind).toBe('recording');
  });

  it('cancels from the back gesture on Leave and keeps the screen', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    expect(pressHardwareBack()).toBe(true);
    await p.press(LEAVE);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.onBack).not.toHaveBeenCalled();
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
    expect(pressHardwareBack()).toBe(false);
  });

  it('drops the leave dialog when a save ends the session under it', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    await act(async () => {
      await p.store.getState().commitRetime();
    });
    await p.press(RETIME);
    await p.touchDown(PAD);
    expect(p.has(LEAVE_TITLE)).toBe(false);
  });

  it('goes through leaveRetime when the screen goes', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    const { leaveRetime } = p.store.getState();
    const leave = vi.fn(leaveRetime);
    p.store.setState({ leaveRetime: leave });
    p.unmount();
    player = undefined;
    p.store.setState({ leaveRetime });
    expect(leave).toHaveBeenCalled();
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
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
