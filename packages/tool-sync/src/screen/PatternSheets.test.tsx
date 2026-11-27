import {
  KB_DENOMINATORS,
  KB_MAX_BEATS,
  KB_SUBDIVISION_BOUNDS,
} from '@kitbag/core-native';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown>;

const sheets = vi.hoisted(() => ({ meter: [] as Props[], sub: [] as Props[] }));
const store = vi.hoisted(() => ({
  pattern: { beatsPerBar: 6, denominator: 8, subdivision: 3 },
  setBeats: vi.fn(),
  setSubdivision: vi.fn(),
}));

vi.mock('@kitbag/core-design', () => ({
  TimeSignatureSheet: (props: Props) => {
    sheets.meter.push(props);
    return null;
  },
  SubdivisionSheet: (props: Props) => {
    sheets.sub.push(props);
    return null;
  },
}));

vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

const { PatternSheets, PATTERN_SHEET } = await import('./PatternSheets.tsx');

function draw(open: (typeof PATTERN_SHEET)[keyof typeof PATTERN_SHEET] | null) {
  sheets.meter.length = 0;
  sheets.sub.length = 0;
  renderToStaticMarkup(
    createElement(PatternSheets, { open, bottomInset: 0, onDismiss: vi.fn() }),
  );
}

describe('PatternSheets', () => {
  it("opens the metronome's time signature sheet on the play-along pattern", () => {
    draw(PATTERN_SHEET.meter);
    expect(sheets.meter[0]).toMatchObject({
      visible: true,
      beatsPerBar: 6,
      denominator: 8,
      maxBeats: KB_MAX_BEATS,
      denominators: KB_DENOMINATORS,
      onSet: store.setBeats,
    });
    expect(sheets.sub[0]).toMatchObject({ visible: false });
  });

  it("opens the metronome's subdivision sheet on the play-along pattern", () => {
    draw(PATTERN_SHEET.subdivision);
    expect(sheets.sub[0]).toMatchObject({
      visible: true,
      subdivision: 3,
      denominator: 8,
      bounds: KB_SUBDIVISION_BOUNDS,
      onPick: store.setSubdivision,
    });
    expect(sheets.meter[0]).toMatchObject({ visible: false });
  });
});
