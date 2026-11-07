import { stemPlayer, stemSections } from '@kitbag/core-design';
import { act } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

import { display, StyleSheet } from '../testing/reactNativeHosts.ts';
import {
  fireLayout,
  flush,
  mountPlayer,
  SONG_DETAILS,
  withTestId,
  type Player,
} from './playerHarness.test-helper.tsx';

const RETIME = 'Retime lyrics';
const PAD = 'Tap as this line starts';
const UNDO_TAP = 'Undo tap';
const LATER = 'Shift all lines later';
const SAVE = 'Save';
const NOT_SAVED = 'Timing not saved. Your taps are still here, try again.';

let player: Player | undefined;

async function retiming() {
  player = await mountPlayer(SONG_DETAILS);
  await player.press('Lyrics');
  await player.press(RETIME);
  return player;
}

afterEach(() => {
  player?.unmount();
  player = undefined;
});

describe('when the body overflows', () => {
  const ONE_SECOND_FRAMES = 44100;
  const LINE_TOP = 120;
  const LINES_TOP = 50;
  const BODY_AT_360_800 = 484;
  const BODY_AT_360_640 = 324;
  const CONTROLS_AT_2X = 370;
  const LINE_AT_2X = 40.4;
  const CHROME = stemSections.retimeGap + stemPlayer.bodyGap;
  const bodyWithLines = (room: number) => room + CONTROLS_AT_2X + CHROME;

  afterEach(() => {
    display.fontScale = 1;
  });

  function overflow(p: Player, content = 900, viewport = BODY_AT_360_800) {
    const [body] = withTestId(p, 'retime-body');
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

  async function pinned() {
    const p = await retiming();
    overflow(p);
    fireLayout(withTestId(p, 'retime-column')[0], { y: LINES_TOP });
    fireLayout(withTestId(p, 'retime-current')[0], { y: LINE_TOP });
    p.scrolls.mockClear();
    return p;
  }

  async function tapLater(p: Player) {
    p.engine.position += ONE_SECOND_FRAMES;
    await p.touchDown(PAD);
  }

  async function failedSave(p: Player) {
    await tapLater(p);
    p.scrolls.mockClear();
    p.records.saveLyricsRetimed.mockRejectedValueOnce(new Error('disk'));
    await p.press(SAVE);
  }

  const TO_CARD = { y: 0, animated: false };
  const TO_LINE = { y: LINES_TOP + LINE_TOP, animated: false };

  const padStyle = (p: Player) =>
    StyleSheet.flatten(p.byLabel(PAD).props.style);

  it('stays as drawn while everything fits, or fills it to the pixel', async () => {
    const p = await retiming();
    overflow(p, 484.5, BODY_AT_360_800);
    expect(withTestId(p, 'retime-body')).toHaveLength(1);
    expect(withTestId(p, 'retime-lines')).toHaveLength(0);
    expect(padStyle(p).flexGrow).toBe(1);
  });

  it('scrolls only the lines, with the pad and Undo outside', async () => {
    const p = await retiming();
    overflow(p);
    expect(withTestId(p, 'retime-body')).toHaveLength(0);
    const [lines] = withTestId(p, 'retime-lines');
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
    const [lines] = withTestId(p, 'retime-lines');
    expect(lines?.props.style).toMatchObject({ flex: 1 });
    expect(padStyle(p).flexGrow).toBe(0);
    expect(padStyle(p).flexShrink).toBe(0);
  });

  it('stays pinned through every tap in the session', async () => {
    const p = await retiming();
    overflow(p);
    await tapLater(p);
    await tapLater(p);
    expect(withTestId(p, 'retime-lines')).toHaveLength(1);
  });

  it('keeps the done and next lines', async () => {
    display.fontScale = 2;
    const p = await retiming();
    overflow(p);
    await tapLater(p);
    expect(p.has('One')).toBe(true);
    expect(p.has('Two')).toBe(true);
    expect(p.has('Three')).toBe(true);
  });

  describe('bringing the line to tap to the top', () => {
    it('follows a tap, with no row laying out', async () => {
      const p = await pinned();
      await tapLater(p);
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_LINE);
    });

    it('follows an undo, with no row laying out', async () => {
      const p = await pinned();
      await tapLater(p);
      p.scrolls.mockClear();
      await p.press(UNDO_TAP);
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_LINE);
    });

    it('follows a seek that moves the line, with no row laying out', async () => {
      const p = await pinned();
      act(() => {
        p.store.getState().seek(44100 * 5.6);
      });
      expect(p.store.getState().retime).toMatchObject({ nextLine: 3 });
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_LINE);
    });

    it('follows a row that moves as it lays out', async () => {
      const p = await pinned();
      fireLayout(withTestId(p, 'retime-current')[0], { y: LINE_TOP + 40 });
      expect(p.scrolls).toHaveBeenLastCalledWith({
        y: LINES_TOP + LINE_TOP + 40,
        animated: false,
      });
    });
  });

  describe('a failed save', () => {
    let warn: MockInstance<typeof console.warn>;

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('scrolls to the card as it appears, with no row laying out', async () => {
      const p = await pinned();
      await failedSave(p);
      const [lines] = withTestId(p, 'retime-lines');
      expect(
        lines?.findAll(
          (n) => String(n.type) === 'Text' && n.children[0] === NOT_SAVED,
        ),
      ).toHaveLength(1);
      expect(p.scrolls).toHaveBeenCalledTimes(1);
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_CARD);
    });

    it('holds the card while the lines lay out under it', async () => {
      const p = await pinned();
      await failedSave(p);
      p.scrolls.mockClear();
      fireLayout(withTestId(p, 'retime-column')[0], { y: LINES_TOP + 80 });
      fireLayout(withTestId(p, 'retime-current')[0], { y: LINE_TOP });
      expect(p.scrolls).not.toHaveBeenCalled();
    });

    it('returns to the line to tap on the next tap, with the card shown', async () => {
      const p = await pinned();
      await failedSave(p);
      p.scrolls.mockClear();
      await tapLater(p);
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_LINE);
      expect(p.has(NOT_SAVED)).toBe(true);
    });

    it('returns to the line to tap on an undo, with the card shown', async () => {
      const p = await pinned();
      await tapLater(p);
      await failedSave(p);
      p.scrolls.mockClear();
      await p.press(UNDO_TAP);
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_LINE);
      expect(p.has(NOT_SAVED)).toBe(true);
    });

    it('scrolls to the card again when a retry fails again', async () => {
      const p = await pinned();
      await failedSave(p);
      await tapLater(p);
      let failWrite: (reason: Error) => void = () => undefined;
      p.records.saveLyricsRetimed.mockReturnValueOnce(
        new Promise((_, reject) => {
          failWrite = reject;
        }),
      );
      await p.press(SAVE);
      expect(p.has(NOT_SAVED)).toBe(false);
      p.scrolls.mockClear();
      await act(async () => {
        failWrite(new Error('disk'));
        await flush();
      });
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_CARD);
    });
  });

  describe('when the pin leaves too little room', () => {
    function measure(p: Player, body: number) {
      overflow(p);
      const line = withTestId(p, 'retime-current')[0]?.find(
        (node) => String(node.type) === 'Text',
      );
      act(() => {
        (line?.props.onTextLayout as (e: unknown) => void)({
          nativeEvent: { lines: [{ height: LINE_AT_2X }] },
        });
      });
      fireLayout(withTestId(p, 'retime-pinned')[0], { height: body });
      fireLayout(withTestId(p, 'retime-controls')[0], {
        height: CONTROLS_AT_2X,
      });
    }

    it.each([
      ['360x800', 124],
      ['360x800 with the note on its own row', 98],
    ])('stays pinned at %s, where two lines fit', async (_, room) => {
      const p = await retiming();
      measure(p, bodyWithLines(room));
      expect(withTestId(p, 'retime-lines')).toHaveLength(1);
      expect(withTestId(p, 'retime-body')).toHaveLength(0);
    });

    it('scrolls the whole body when two lines miss by a dp', async () => {
      const p = await retiming();
      measure(p, bodyWithLines(92));
      expect(withTestId(p, 'retime-lines')).toHaveLength(0);
      expect(withTestId(p, 'retime-body')).toHaveLength(1);
    });

    it('scrolls the whole body at 360x640, with everything inside', async () => {
      const p = await retiming();
      measure(p, BODY_AT_360_640);
      expect(withTestId(p, 'retime-lines')).toHaveLength(0);
      const [body] = withTestId(p, 'retime-body');
      for (const label of [PAD, UNDO_TAP, LATER])
        expect(
          body?.findAll(
            (n) =>
              typeof n.type === 'string' &&
              n.props.accessibilityLabel === label,
          ),
        ).toHaveLength(1);
    });

    it('never pins again in that session', async () => {
      const p = await retiming();
      measure(p, BODY_AT_360_640);
      await tapLater(p);
      expect(withTestId(p, 'retime-lines')).toHaveLength(0);
    });

    it('shows a failed save at the top of the whole body', async () => {
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const p = await retiming();
      measure(p, BODY_AT_360_640);
      await failedSave(p);
      expect(p.scrolls).toHaveBeenLastCalledWith(TO_CARD);
      warn.mockRestore();
    });
  });
});
