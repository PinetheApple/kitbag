// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { useAfterSheetClosed } from './useAfterSheetClosed.ts';

function mounted() {
  let hook: ReturnType<typeof useAfterSheetClosed> | undefined;
  function Probe() {
    hook = useAfterSheetClosed();
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  if (hook === undefined) throw new Error('not mounted');
  return hook;
}

it('runs what was asked for once, when the sheet has closed', () => {
  const { after, closed } = mounted();
  const then = vi.fn();
  after(then);
  expect(then).not.toHaveBeenCalled();
  closed();
  closed();
  expect(then).toHaveBeenCalledOnce();
});

it('does nothing on a close nobody asked to follow', () => {
  const { closed } = mounted();
  expect(() => {
    closed();
  }).not.toThrow();
});
