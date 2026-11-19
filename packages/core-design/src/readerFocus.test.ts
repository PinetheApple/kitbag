import { afterEach, expect, it, vi } from 'vitest';

const sendAccessibilityEvent = vi.fn();
vi.mock('react-native', () => ({
  AccessibilityInfo: { sendAccessibilityEvent },
}));

type ReaderFocus = typeof import('./readerFocus.ts');
type Node = Parameters<ReaderFocus['focusReaderOn']>[0];

const loadFresh = (): Promise<ReaderFocus> => import('./readerFocus.ts');

afterEach(() => {
  sendAccessibilityEvent.mockClear();
  vi.resetModules();
});

it('sends a focus event to a node when no focuser is installed', async () => {
  const { focusReaderOn } = await loadFresh();
  const node = {} as Node;
  focusReaderOn(node);
  expect(sendAccessibilityEvent).toHaveBeenCalledWith(node, 'focus');
});

it('sends nothing as the node unmounts', async () => {
  const { focusReaderOn } = await loadFresh();
  focusReaderOn(null);
  expect(sendAccessibilityEvent).not.toHaveBeenCalled();
});

it('hands the node to the installed focuser instead of the event', async () => {
  const { focusReaderOn, setReaderFocuser } = await loadFresh();
  const focuser = vi.fn();
  setReaderFocuser(focuser);
  const node = {} as Node;
  focusReaderOn(node);
  expect(focuser).toHaveBeenCalledExactlyOnceWith(node);
  expect(sendAccessibilityEvent).not.toHaveBeenCalled();
});
