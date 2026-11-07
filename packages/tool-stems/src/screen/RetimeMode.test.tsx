import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  display,
  pressHardwareBack,
  StyleSheet,
} from '../testing/reactNativeHosts.ts';
import {
  flush,
  mountPlayer,
  PLAIN_LYRICS,
  SONG_DETAILS,
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
});

describe('when the body overflows', () => {
  afterEach(() => {
    display.fontScale = 1;
  });

  function withId(p: Player, testID: string) {
    return p.renderer.root.findAll(
      (node) => typeof node.type === 'string' && node.props.testID === testID,
    );
  }

  function overflow(p: Player, content = 900, viewport = 484) {
    const [body] = withId(p, 'retime-body');
    act(() => {
      (body?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { height: viewport } },
      });
      (body?.props.onContentSizeChange as (w: number, h: number) => void)(
        360,
        content,
      );
    });
  }

  const padStyle = (p: Player) =>
    StyleSheet.flatten(p.byLabel(PAD).props.style);

  it('stays as drawn while everything fits, or fills it to the pixel', async () => {
    const p = await retiming();
    overflow(p, 484.5, 484);
    expect(withId(p, 'retime-body')).toHaveLength(1);
    expect(withId(p, 'retime-lines')).toHaveLength(0);
    expect(padStyle(p).flexGrow).toBe(1);
  });

  it('scrolls only the lines, with the pad and Undo outside', async () => {
    const p = await retiming();
    overflow(p);
    expect(withId(p, 'retime-body')).toHaveLength(0);
    const [lines] = withId(p, 'retime-lines');
    expect(String(lines?.type)).toBe('ScrollView');
    const scrolling = p.renderer.root.findAll(
      (node) => String(node.type) === 'ScrollView',
    );
    for (const scroller of scrolling) {
      for (const label of [PAD, UNDO_TAP, LATER])
        expect(
          scroller.findAll((n) => n.props.accessibilityLabel === label),
        ).toEqual([]);
    }
    expect(p.labelled(PAD)).toHaveLength(1);
    expect(p.labelled(UNDO_TAP)).toHaveLength(1);
  });

  it('gives the lines all the spare height, so a line cannot move the pad', async () => {
    const p = await retiming();
    overflow(p);
    const [lines] = withId(p, 'retime-lines');
    expect(lines?.props.style).toMatchObject({ flex: 1 });
    expect(padStyle(p).flexGrow).toBe(0);
    expect(padStyle(p).flexShrink).toBe(0);
  });

  it('stays pinned through every tap in the session', async () => {
    const p = await retiming();
    overflow(p);
    await p.touchDown(PAD);
    await p.touchDown(PAD);
    expect(withId(p, 'retime-lines')).toHaveLength(1);
  });

  it('keeps the done and next lines, and brings the line to tap to the top', async () => {
    display.fontScale = 2;
    const p = await retiming();
    overflow(p);
    p.engine.position = 44100 * 2;
    await p.touchDown(PAD);
    expect(p.has('One')).toBe(true);
    expect(p.has('Two')).toBe(true);
    expect(p.has('Three')).toBe(true);
    const [row] = withId(p, 'retime-current');
    p.scrolls.mockClear();
    act(() => {
      (row?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { y: 120 } },
      });
    });
    expect(p.scrolls).toHaveBeenCalledWith({ y: 120, animated: false });
  });

  it('keeps a failed save in the scrolling part, scrolled to it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await retiming();
    overflow(p);
    p.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    await p.touchDown(PAD);
    await p.press(SAVE);
    const [lines] = withId(p, 'retime-lines');
    expect(
      lines?.findAll(
        (n) => String(n.type) === 'Text' && n.children[0] === NOT_SAVED,
      ),
    ).toHaveLength(1);
    const [row] = withId(p, 'retime-current');
    p.scrolls.mockClear();
    act(() => {
      (row?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { y: 120 } },
      });
    });
    expect(p.scrolls).toHaveBeenCalledWith({ y: 0, animated: false });
    warn.mockRestore();
  });

  it('draws no bar beside the line to tap', async () => {
    const p = await retiming();
    const [row] = withId(p, 'retime-current');
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
  it('drops the session from the close button, writing nothing', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    expect(p.store.getState().retime.kind).toBe('off');
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

  it('cancels on the back gesture and keeps the screen', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    expect(pressHardwareBack()).toBe(true);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.onBack).not.toHaveBeenCalled();
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
    expect(pressHardwareBack()).toBe(false);
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
