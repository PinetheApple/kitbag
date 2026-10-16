import { describe, expect, it } from 'vitest';

import { emojiCapableIcons, icons, isShapeIcon, shapeIcons } from './icons.ts';

const VS15 = '︎';
const VS16 = '️';

describe('icons', () => {
  it('forces text presentation on every glyph Unicode lets render as emoji', () => {
    for (const name of emojiCapableIcons) {
      expect(icons[name].endsWith(VS15)).toBe(true);
    }
  });

  it('never asks for emoji presentation', () => {
    for (const glyph of Object.values(icons)) {
      expect(glyph.includes(VS16)).toBe(false);
    }
  });

  it('maps each name to one visible glyph', () => {
    for (const glyph of Object.values(icons)) {
      expect(Array.from(glyph.replace(VS15, ''))).toHaveLength(1);
    }
  });

  it('keeps shape names out of the glyph map so a name has one renderer', () => {
    for (const name of shapeIcons) {
      expect(Object.keys(icons)).not.toContain(name);
      expect(isShapeIcon(name)).toBe(true);
    }
    expect(isShapeIcon('confirm')).toBe(false);
  });
});
