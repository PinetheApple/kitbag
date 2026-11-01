import { metronome, space } from '@kitbag/core-design';
import { expect, it, vi } from 'vitest';

type Styles = Record<string, Record<string, unknown>>;

const { sheets } = vi.hoisted(() => ({ sheets: [] as Styles[] }));
const color = new Proxy({}, { get: (_target, key) => String(key) });

vi.mock('@kitbag/core-design', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createThemedStyles: (factory: (theme: unknown) => Styles) => {
    const styles = factory({ color });
    sheets.push(styles);
    return () => styles;
  },
}));
vi.mock('@kitbag/core-state', () => ({ useMetronome: vi.fn() }));
vi.mock('react-native-reanimated', () => ({ default: { View: 'View' } }));
vi.mock('./LiveSlot.tsx', () => ({ LiveSlot: 'LiveSlot' }));
vi.mock('./statusStyles.ts', () => ({ useStatusStyles: vi.fn() }));
vi.mock('./StatusVariant.tsx', () => ({ StatusVariant: 'StatusVariant' }));
vi.mock('./PolyStrip.tsx', () => ({ PolyStrip: 'PolyStrip' }));
vi.mock('./PracticeSection.tsx', () => ({
  PracticeSection: 'PracticeSection',
  usePracticeStyles: vi.fn(),
}));
vi.mock('./useBarMuteEditor.ts', () => ({ useBarMuteEditor: vi.fn() }));

await import('./MuteStatus.tsx');
await import('./PracticeSections.tsx');

const MARGINS = ['margin', 'marginHorizontal', 'marginLeft', 'marginRight'];

function sheetWith(key: string): Styles {
  const found = sheets.find((styles) => key in styles);
  if (found === undefined) throw new Error(`no styles with ${key}`);
  return found;
}

const strips = [
  {
    name: 'status row cycle strip',
    row: sheetWith('strip').strip,
    cell: sheetWith('strip').cell,
    gap: metronome.cycleCellGap,
  },
  {
    name: 'Practice sheet mute preview',
    row: sheetWith('preview').preview,
    cell: sheetWith('preview').cell,
    gap: space.barPreviewGap,
  },
];

it.each(strips)(
  'the $name shrinks its cells, never its gap',
  ({ row, cell, gap }) => {
    expect(row?.flexDirection).toBe('row');
    expect(row?.gap).toBeGreaterThanOrEqual(gap);
    expect(gap).toBeGreaterThan(0);
    for (const margin of MARGINS) expect(cell?.[margin]).toBeUndefined();
    const shrinks = cell?.flex === 1 || Number(cell?.flexShrink) >= 1;
    expect(shrinks).toBe(true);
  },
);
