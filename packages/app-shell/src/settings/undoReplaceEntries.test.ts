import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], next: 0 }));
const backup = vi.hoisted(() => {
  const restore: Record<string, unknown> = { phase: 'empty' };
  return {
    restore,
    takenAt: null as string | null,
    copyKept: true,
    readers: [] as (() => Promise<unknown>)[],
  };
});

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: <T>(make: () => T) => make(),
  useCallback: <T>(fn: T) => fn,
  useEffect: () => undefined,
  useState: <T>(initial: T) => {
    const slot = hooks.next++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
    const set = (next: T) => {
      hooks.slots[slot] = next;
    };
    return [hooks.slots[slot] as T, set];
  },
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    effect();
  },
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Button: 'Button',
  Card: 'Card',
  EditRow: 'EditRow',
  EditValue: 'EditValue',
  Sheet: 'Sheet',
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
  textStyle: () => ({}),
}));

vi.mock('./SettingsFrame.tsx', () => ({ SettingsFrame: 'SettingsFrame' }));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useRestore: (select: (state: unknown) => unknown) =>
    select({
      restore: backup.restore,
      pick: () => Promise.resolve(),
      reset: () => undefined,
    }),
  restoreStore: {
    getState: () => ({
      open: (read: () => Promise<unknown>) => {
        backup.readers.push(read);
        return read().then(() => true);
      },
    }),
  },
  openableBeforeReplace: (name: string) =>
    Promise.resolve(
      backup.copyKept ? { name, bytes: 1, contents: '{}' } : null,
    ),
  beforeReplaceTakenAt: () => Promise.resolve(backup.takenAt),
}));

const { RestoreScreen } = await import('./RestoreScreen.tsx');
const { UndoReplaceRow } = await import('./BackupRows.tsx');

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Node = ReactElement<Props>;

const TAKEN_AT = new Date(2026, 10, 27, 14, 32).toISOString();
const DONE = { counts: {}, soundResets: 0 };

function expand(node: unknown): Node[] {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!isValidElement(node)) return [];
  const element = node as Node;
  if (typeof element.type === 'function')
    return expand((element.type as (props: Props) => ReactNode)(element.props));
  return [element, ...expand(element.props.children)];
}

function render(tree: ReactNode): Node[] {
  hooks.next = 0;
  return expand(tree);
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

const named = (type: string, label: string) => (node: Node) =>
  node.type === type && node.props.label === label;

function press(node: Node | undefined) {
  if (node === undefined) throw new Error('nothing to press');
  (node.props.onPress as () => void)();
}

async function openedCopy() {
  const [read] = backup.readers;
  if (read === undefined) throw new Error('nothing opened');
  return read();
}

beforeEach(() => {
  hooks.slots = [];
  backup.readers = [];
  backup.takenAt = null;
  backup.copyKept = true;
});

describe('the Replace done screen', () => {
  const screen = () => render(RestoreScreen({ onBack: () => undefined }));

  it('offers Undo replace, which opens the copy kept before it', async () => {
    backup.restore = { phase: 'done', mode: 'replace', ...DONE };
    press(screen().find(named('Button', 'Undo replace')));
    await settle();
    expect(await openedCopy()).toMatchObject({ name: 'Before replace' });
  });

  it('offers no undo after a merge', () => {
    backup.restore = { phase: 'done', mode: 'merge', ...DONE };
    expect(screen().some(named('Button', 'Undo replace'))).toBe(false);
  });
});

describe('the Undo last replace row', () => {
  async function row(onOpenRestore: () => void = () => undefined) {
    render(UndoReplaceRow({ onOpenRestore }));
    await settle();
    return render(UndoReplaceRow({ onOpenRestore }));
  }

  it('is hidden with no copy kept', async () => {
    expect((await row()).some((node) => node.type === 'EditRow')).toBe(false);
  });

  it('shows when the copy was taken', async () => {
    backup.takenAt = TAKEN_AT;
    const shown = (await row()).find(named('EditRow', 'Undo last replace'));
    expect(shown?.props.accessibilityLabel).toBe(
      'Undo last replace, 27 Nov · 14:32',
    );
  });

  it('opens the copy in Restore', async () => {
    backup.takenAt = TAKEN_AT;
    const openRestore = vi.fn();
    press((await row(openRestore)).find(named('EditRow', 'Undo last replace')));
    await settle();
    expect(await openedCopy()).toMatchObject({ name: 'Before replace' });
    expect(openRestore).toHaveBeenCalledOnce();
  });

  it('stays on Settings when the copy is gone', async () => {
    backup.takenAt = TAKEN_AT;
    const openRestore = vi.fn();
    const shown = await row(openRestore);
    backup.copyKept = false;
    press(shown.find(named('EditRow', 'Undo last replace')));
    await settle();
    expect(openRestore).not.toHaveBeenCalled();
  });
});
