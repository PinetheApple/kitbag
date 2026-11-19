import { expect, it, vi } from 'vitest';

const sendAccessibilityEvent = vi.fn();
vi.mock('react-native', () => ({
  AccessibilityInfo: { sendAccessibilityEvent },
}));

const { focusReaderOn, setReaderFocuser } = await import('./readerFocus.ts');

type Node = Parameters<typeof focusReaderOn>[0];

it('sends a focus event to a node when no focuser is installed', () => {
  const node = {} as Node;
  focusReaderOn(node);
  expect(sendAccessibilityEvent).toHaveBeenCalledWith(node, 'focus');
});

it('sends nothing as the node unmounts', () => {
  sendAccessibilityEvent.mockClear();
  focusReaderOn(null);
  expect(sendAccessibilityEvent).not.toHaveBeenCalled();
});

it('hands the node to the installed focuser instead of the event', () => {
  sendAccessibilityEvent.mockClear();
  const focuser = vi.fn();
  setReaderFocuser(focuser);
  const node = {} as Node;
  focusReaderOn(node);
  focusReaderOn(null);
  expect(focuser).toHaveBeenCalledExactlyOnceWith(node);
  expect(sendAccessibilityEvent).not.toHaveBeenCalled();
});
