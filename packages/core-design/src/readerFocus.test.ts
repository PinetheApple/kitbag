import { expect, it, vi } from 'vitest';

const sendAccessibilityEvent = vi.fn();
vi.mock('react-native', () => ({
  AccessibilityInfo: { sendAccessibilityEvent },
}));

const { focusReaderOn } = await import('./readerFocus.ts');

it('sends screen reader focus to a node as it mounts', () => {
  const node = {};
  focusReaderOn(node as Parameters<typeof focusReaderOn>[0]);
  expect(sendAccessibilityEvent).toHaveBeenCalledWith(node, 'focus');
});

it('sends nothing as the node unmounts', () => {
  sendAccessibilityEvent.mockClear();
  focusReaderOn(null);
  expect(sendAccessibilityEvent).not.toHaveBeenCalled();
});
