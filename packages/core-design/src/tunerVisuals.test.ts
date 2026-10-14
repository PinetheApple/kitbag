import { describe, expect, it } from 'vitest';

import { themes, withAlpha } from './theme.ts';
import {
  stripPosition,
  TUNE_DIRECTION,
  tuneGlyph,
  tunerStripGradient,
} from './tunerVisuals.ts';

describe('tunerStripGradient', () => {
  it('reproduces the design stops from the theme tokens', () => {
    const { color } = themes.dark;
    expect(tunerStripGradient(color)).toBe(
      `linear-gradient(90deg, ${color.red} 0%, ${color.amber} 30%, ` +
        `${color.green} 47%, ${color.green} 53%, ${color.amber} 70%, ` +
        `${color.red} 100%)`,
    );
  });

  it('follows the theme rather than holding its own colours', () => {
    expect(tunerStripGradient(themes.light.color)).toContain(
      themes.light.color.green,
    );
    expect(tunerStripGradient(themes.light.color)).not.toContain(
      themes.dark.color.green,
    );
  });
});

describe('stripPosition', () => {
  it('maps the needle range onto the strip width', () => {
    expect(stripPosition(-1)).toBe(0);
    expect(stripPosition(0)).toBe(0.5);
    expect(stripPosition(1)).toBe(1);
    expect(stripPosition(-0.5)).toBe(0.25);
  });

  it('pins out-of-range readings to the strip ends', () => {
    expect(stripPosition(-3)).toBe(0);
    expect(stripPosition(7)).toBe(1);
  });

  it('parks a missing reading on the centre line', () => {
    expect(stripPosition(Number.NaN)).toBe(0.5);
    expect(stripPosition(Number.POSITIVE_INFINITY)).toBe(0.5);
  });
});

describe('tuneGlyph', () => {
  it('maps each direction constant to its glyph', () => {
    expect(tuneGlyph(TUNE_DIRECTION.up)).toBe('up');
    expect(tuneGlyph(TUNE_DIRECTION.down)).toBe('down');
    expect(tuneGlyph(TUNE_DIRECTION.inTune)).toBe('inTune');
    expect(tuneGlyph(TUNE_DIRECTION.none)).toBe('none');
  });

  it('accepts any signed value, so Math.sign output works directly', () => {
    expect(tuneGlyph(0.2)).toBe('up');
    expect(tuneGlyph(-12)).toBe('down');
    expect(tuneGlyph(-0)).toBe('inTune');
  });
});

describe('withAlpha', () => {
  it('appends the alpha byte CSS color-mix with transparent would give', () => {
    expect(withAlpha('#FFB347', 0.4)).toBe('#FFB34766');
    expect(withAlpha('#FFB347', 1)).toBe('#FFB347FF');
    expect(withAlpha('#FFB347', 0)).toBe('#FFB34700');
  });
});
