import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

type Props = Readonly<{ gesture?: unknown; children?: ReactNode }>;

const portal = vi.hoisted(() => ({
  shown: [] as unknown[],
  show: (_id: string, node: unknown) => {
    portal.shown.push(node);
  },
  hide: () => undefined,
}));

vi.mock('react', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useEffect: (effect: () => unknown) => {
    effect();
  },
  useId: () => 'overlay',
  useMemo: <T,>(make: () => T) => make(),
}));
vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: 'GestureDetector',
}));
vi.mock('react-native-reanimated', () => ({ default: { View: 'Layer' } }));
vi.mock('./SheetHost.tsx', () => ({ useSheetPortal: () => portal }));

const { WindowOverlay } = await import('./WindowOverlay.tsx');

const SWIPE = { swipe: 'tempo' } as unknown as Parameters<
  typeof WindowOverlay
>[0]['gesture'];

function drawn(gesture?: typeof SWIPE): ReactElement<Props> {
  portal.shown.length = 0;
  WindowOverlay({
    children: 'card',
    ...(gesture === undefined ? null : { gesture }),
  });
  return portal.shown.at(-1) as ReactElement<Props>;
}

describe('WindowOverlay', () => {
  it('hands its gesture to a detector around the whole dimmed layer', () => {
    const node = drawn(SWIPE);
    expect(node.type).toBe('GestureDetector');
    expect(node.props.gesture).toBe(SWIPE);
    expect((node.props.children as ReactElement).type).toBe('Layer');
  });

  it('draws the dimmed layer bare when it has no gesture', () => {
    expect(drawn().type).toBe('Layer');
  });
});
