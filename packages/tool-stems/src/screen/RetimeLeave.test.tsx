import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { pressHardwareBack } from '../testing/reactNativeHosts.ts';
import {
  CLOSE,
  DIALOG_TITLE,
  flush,
  HIDDEN_FROM_READERS,
  holdSave,
  LATER,
  NOT_SAVED,
  PAD,
  RESET,
  RETIME,
  RETIME_CONTROLS,
  retiming,
  SAVE,
  SHOWN_TO_READERS,
  UNDO_TAP,
  unmountTracked,
} from './playerHarness.test-helper.tsx';

const LEAVE_TITLE = 'Leave without saving?';
const LEAVE = 'Leave';
const KEEP_TAPPING = 'Keep tapping';

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

  it('puts screen reader focus on its title', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    expect(p.readerFocus()).toEqual([LEAVE_TITLE]);
  });

  it('hides the screen behind it from screen readers until Keep tapping', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    for (const label of RETIME_CONTROLS)
      expect(p.readerHiding(label), label).toEqual(HIDDEN_FROM_READERS);
    expect(p.textReaderHiding(LEAVE_TITLE)).toEqual(SHOWN_TO_READERS);
    for (const label of [KEEP_TAPPING, LEAVE])
      expect(p.readerHiding(label), label).toEqual(SHOWN_TO_READERS);
    await p.press(KEEP_TAPPING);
    for (const label of RETIME_CONTROLS)
      expect(p.readerHiding(label), label).toEqual(SHOWN_TO_READERS);
  });

  it('shows the screen again when nothing is left to drop under the dialog', async () => {
    const p = await retiming();
    await p.touchDown(PAD);
    await p.press(CLOSE);
    await p.press(UNDO_TAP);
    expect(p.has(LEAVE_TITLE)).toBe(false);
    for (const label of RETIME_CONTROLS)
      expect(p.readerHiding(label), label).toEqual(SHOWN_TO_READERS);
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
    const refuse = holdSave(p);
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

  it('holds Leave while a save runs, and leaves once the save is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await retiming();
    const refuse = holdSave(p);
    await p.touchDown(PAD);
    await p.press(SAVE);
    expect(pressHardwareBack()).toBe(true);
    expect(p.has(LEAVE_TITLE)).toBe(true);
    await p.press(LEAVE);
    expect(p.has(LEAVE_TITLE)).toBe(true);
    expect(p.store.getState().retime).toMatchObject({
      kind: 'recording',
      taps: [expect.anything()],
    });
    refuse(new Error('disk'));
    await flush();
    expect(p.store.getState().retimeFailure).toBe('notStored');
    await p.press(LEAVE);
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.has(LEAVE_TITLE)).toBe(false);
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
    unmountTracked();
    p.store.setState({ leaveRetime });
    expect(leave).toHaveBeenCalled();
    expect(p.store.getState().retime.kind).toBe('off');
    expect(p.records.saveLyricsRetimed).not.toHaveBeenCalled();
  });
});
