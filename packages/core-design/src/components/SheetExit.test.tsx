import { act } from 'react';
import type { HostInstance } from 'react-native';
import { expect, it, vi } from 'vitest';

import {
  ACTIONS,
  anim,
  DELETE,
  dismissKeyboard,
  finishExits,
  focusReaderOn,
  lastTiming,
  mount,
  REDUCED,
  rerender,
  settleFrames,
  slotTitled,
  SONG,
  titles,
} from './sheetExit.test-helper.tsx';

it('keeps a sheet swapped out in one commit until its exit finishes', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  expect(titles(tree)).toEqual([ACTIONS, DELETE]);
  finishExits();
  settleFrames();
  expect(titles(tree)).toEqual([DELETE]);
});

it('leaves no layout exit animation in the tree', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  expect(tree.root.findAll((node) => 'exiting' in node.props)).toEqual([]);
});

it('takes the leaving sheet out of touch and reader reach while the new one gets focus', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  const leaving = slotTitled(tree, ACTIONS);
  const arriving = slotTitled(tree, DELETE);
  expect(leaving.props).toMatchObject({
    pointerEvents: 'none',
    importantForAccessibility: 'no-hide-descendants',
  });
  expect(arriving.props).toMatchObject({
    pointerEvents: 'auto',
    importantForAccessibility: 'auto',
  });
  const enter = lastTiming();
  act(() => {
    enter(true);
  });
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: DELETE });
});

it('keeps a sheet that is shown again before its exit finishes', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  rerender(tree, { actions: true, remove: false });
  finishExits();
  expect(titles(tree)).toEqual([ACTIONS]);
  expect(slotTitled(tree, ACTIONS).props.pointerEvents).toBe('auto');
});

it('removes the sheet once its immediate exit settles under reduce motion', async () => {
  anim.motion = REDUCED;
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  await act(async () => {
    await Promise.resolve();
  });
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('keeps showing what a sheet last held while it slides out', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false, detail: null });
  const details = slotTitled(tree, ACTIONS).findAll(
    (node) => node.type === ('Detail' as never),
  );
  expect(details.map((node): unknown => node.props.name)).toEqual([SONG]);
});

it('drops the keyboard once a sheet starts to leave', () => {
  const tree = mount({ actions: true, remove: false });
  expect(dismissKeyboard).not.toHaveBeenCalled();
  rerender(tree, { actions: false, remove: false });
  expect(dismissKeyboard).toHaveBeenCalledOnce();
});

function arrive() {
  const slide = lastTiming();
  act(() => {
    slide(true);
  });
  focusReaderOn.mockClear();
}

it('moves reader focus back to the title of a sheet shown again mid-exit', () => {
  const tree = mount({ actions: true, remove: false });
  arrive();
  rerender(tree, { actions: false, remove: false });
  rerender(tree, { actions: true, remove: false });
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: ACTIONS });
});

it('puts a sheet shown again mid-exit above one opened meanwhile', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  rerender(tree, { actions: true, remove: true });
  expect(titles(tree)).toEqual([DELETE, ACTIONS]);
  expect(slotTitled(tree, DELETE).props.importantForAccessibility).toBe(
    'no-hide-descendants',
  );
  expect(slotTitled(tree, ACTIONS).props).toMatchObject({
    pointerEvents: 'auto',
    importantForAccessibility: 'auto',
  });
});

it('keeps a sheet shown again when its exit reports finished late', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  const settle = lastTiming();
  rerender(tree, { actions: true, remove: false });
  act(() => {
    settle(true);
  });
  expect(titles(tree)).toEqual([ACTIONS]);
});

it('moves reader focus back to the initial focus target of a sheet shown again mid-exit', () => {
  const focus = { current: { start: true } as unknown as HostInstance };
  const tree = mount({ actions: true, remove: false, focus });
  arrive();
  rerender(tree, { actions: false, remove: false, focus });
  rerender(tree, { actions: true, remove: false, focus });
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith(focus.current);
});

it('reports a sheet closed only once its slot has left the tree', () => {
  const closed = vi.fn();
  const tree = mount({ actions: true, remove: false, closed });
  rerender(tree, { actions: false, remove: false, closed });
  finishExits();
  expect(closed).not.toHaveBeenCalled();
  settleFrames();
  expect(titles(tree)).toEqual([]);
  expect(closed).toHaveBeenCalledOnce();
});

it('does not report a sheet closed when it is shown again before its exit ends', () => {
  const closed = vi.fn();
  const tree = mount({ actions: true, remove: false, closed });
  rerender(tree, { actions: false, remove: false, closed });
  rerender(tree, { actions: true, remove: false, closed });
  finishExits();
  settleFrames();
  expect(closed).not.toHaveBeenCalled();
});
