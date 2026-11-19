// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { expect, it } from 'vitest';

import {
  ACTIONS,
  anim,
  DELETE,
  finishExits,
  focusReaderOn,
  frames,
  keyboard,
  mount,
  rerender,
  runFrame,
  settleFrames,
  slotTitled,
  titles,
} from './sheetExit.test-helper.tsx';

const KEYBOARD_OPEN = -300;
const KEYBOARD_CLOSING = -120;
const SHORT_DRAG = 40;

interface PanHandle {
  readonly pan: {
    readonly update?: (event: { translationY: number }) => void;
    readonly end?: (event: { translationY: number }) => void;
  };
}

function shortDrag(tree: ReactTestRenderer, title: string) {
  const detector = slotTitled(tree, title).find(
    (node) => node.type === ('GestureDetector' as never),
  );
  const { pan } = detector.props.gesture as PanHandle;
  const event = { translationY: SHORT_DRAG };
  act(() => {
    pan.update?.(event);
    pan.end?.(event);
  });
}

interface StyleHandle {
  readonly updater: () => { paddingBottom?: number };
}

function cardPadding(tree: ReactTestRenderer, title: string): unknown {
  const handles = slotTitled(tree, title)
    .findAll((node) => Array.isArray(node.props.style))
    .flatMap((node) => node.props.style as unknown[])
    .filter(
      (style): style is StyleHandle =>
        typeof (style as Partial<StyleHandle> | null)?.updater === 'function',
    );
  return handles
    .map((handle) => handle.updater().paddingBottom)
    .find((padding) => padding !== undefined);
}

it('removes a leaving slot only after a frame has run past its exit', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  finishExits();
  expect(titles(tree)).toEqual([ACTIONS, DELETE]);
  let framesRun = 0;
  while (titles(tree).length > 1 && frames.length > 0) {
    runFrame();
    framesRun += 1;
  }
  expect(framesRun).toBeGreaterThan(0);
  expect(titles(tree)).toEqual([DELETE]);
});

it('keeps a sheet shown again after its exit finished but before removal', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  finishExits();
  rerender(tree, { actions: true, remove: false });
  settleFrames();
  expect(titles(tree)).toEqual([ACTIONS]);
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: ACTIONS });
});

it('lets a drag that was under way when the exit started neither stop nor undo it', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  shortDrag(tree, ACTIONS);
  finishExits();
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('removes an open sheet at once when its owner unmounts', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: true, owned: false, remove: false });
  expect(titles(tree)).toEqual([]);
});

it('lets only the latest exit remove a sheet hidden, shown and hidden again', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  finishExits();
  rerender(tree, { actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  settleFrames();
  expect(titles(tree)).toEqual([ACTIONS]);
  finishExits();
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('stops a sheet whose owner unmounts mid-exit before removing it', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  rerender(tree, { actions: false, owned: false, remove: false });
  expect(anim.running.size).toBe(0);
  expect(titles(tree)).toEqual([ACTIONS]);
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('follows the keyboard while open and holds its padding while leaving', () => {
  const tree = mount({ actions: true, remove: false });
  const closed = cardPadding(tree, ACTIONS);
  keyboard.height.value = KEYBOARD_OPEN;
  const open = cardPadding(tree, ACTIONS);
  expect(open).not.toEqual(closed);
  rerender(tree, { actions: false, remove: false });
  keyboard.height.value = KEYBOARD_CLOSING;
  expect(cardPadding(tree, ACTIONS)).toEqual(open);
});
