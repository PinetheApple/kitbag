import { describe, expect, it } from 'vitest';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { iconGlyphs } from './icons.ts';

describe('icons', () => {
  it('maps every name to a glyph the icon font actually has', () => {
    for (const glyph of Object.values(iconGlyphs)) {
      expect(Object.keys(glyphMap)).toContain(glyph);
    }
  });
});
