import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { switchA11y, switchStyles } from './switchStyles.ts';
import { mixHex, themes } from './theme.ts';

const DESIGN_TOG = {
  width: 38,
  height: 22,
  borderRadius: 99,
  borderWidth: 1,
  knob: 16,
  knobInset: 2,
  knobRadius: '50%',
  onTint: 0.3,
} as const;

const KNOB_ON_LEFT =
  DESIGN_TOG.width -
  DESIGN_TOG.borderWidth * 2 -
  DESIGN_TOG.knob -
  DESIGN_TOG.knobInset;

const componentsDir = join(import.meta.dirname, 'components');

describe('switchStyles', () => {
  it.each(Object.values(themes))(
    'draws the settings design switch in $mode',
    (theme) => {
      const { color } = theme;
      const styles = switchStyles(theme);
      expect(styles.track).toEqual({
        width: DESIGN_TOG.width,
        height: DESIGN_TOG.height,
        borderRadius: DESIGN_TOG.borderRadius,
        borderWidth: DESIGN_TOG.borderWidth,
        borderColor: color.line,
        backgroundColor: color.surface3,
      });
      expect(styles.trackOn).toEqual({
        borderColor: color.accentDim,
        backgroundColor: mixHex(
          color.accent,
          color.surface3,
          DESIGN_TOG.onTint,
        ),
      });
      expect(styles.knob).toEqual({
        position: 'absolute',
        top: DESIGN_TOG.knobInset,
        left: DESIGN_TOG.knobInset,
        width: DESIGN_TOG.knob,
        height: DESIGN_TOG.knob,
        borderRadius: DESIGN_TOG.knobRadius,
        backgroundColor: color.text3,
      });
      expect(styles.knobOn).toEqual({
        left: KNOB_ON_LEFT,
        backgroundColor: color.accent,
      });
    },
  );
});

describe('switchA11y', () => {
  it.each([true, false])('exposes a switch checked=%s', (value) => {
    expect(switchA11y(value)).toEqual({
      accessibilityRole: 'switch',
      accessibilityState: { checked: value },
      'aria-checked': value,
    });
  });
});

describe('one switch', () => {
  it('has no variant and one track implementation', () => {
    const switchSource = readFileSync(
      join(componentsDir, 'Switch.tsx'),
      'utf8',
    );
    const editRowSource = readFileSync(
      join(componentsDir, 'EditRow.tsx'),
      'utf8',
    );
    expect(switchSource).not.toMatch(/variant/i);
    expect(editRowSource).not.toMatch(/variant/i);
    expect(editRowSource).toMatch(/<SwitchTrack\b/);
  });
});
