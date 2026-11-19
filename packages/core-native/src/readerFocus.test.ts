import { beforeEach, expect, it, vi } from 'vitest';

const TAG = 42;
const tagged = {};
const untagged = {};

const commands = vi.hoisted(() => ({ focusReaderView: vi.fn() }));
vi.mock('./NativeKitbagCommands', () => ({
  getKitbagCommands: () => commands,
}));
vi.mock('react-native', () => ({
  findNodeHandle: (node: unknown) => (node === tagged ? TAG : null),
}));

const { focusReaderNode } = await import('./readerFocus.ts');

type Node = Parameters<typeof focusReaderNode>[0];

beforeEach(() => {
  commands.focusReaderView.mockClear();
});

it('asks native to move reader focus to the node by its tag', () => {
  focusReaderNode(tagged as Node);
  expect(commands.focusReaderView).toHaveBeenCalledExactlyOnceWith(TAG);
});

it('sends nothing for an unmounted or untagged node', () => {
  focusReaderNode(null);
  focusReaderNode(untagged as Node);
  expect(commands.focusReaderView).not.toHaveBeenCalled();
});
