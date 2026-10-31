import { describe, expect, it } from 'vitest';

import { switchA11y, switchHitBox, switchStyles } from './switch.ts';
import { space } from './roles.ts';
import { mixHex, themes } from './theme.ts';
import { minTouchTargetDp } from './tokens.ts';

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

describe('switchHitBox', () => {
  it('takes at most half the control gap on each side by default', () => {
    const box = switchHitBox();
    const halfGap = space.controlGap / 2;
    for (const side of [
      box.paddingTop,
      box.paddingRight,
      box.paddingBottom,
      box.paddingLeft,
    ]) {
      expect(side).toBeLessThanOrEqual(halfGap);
    }
  });

  it('reaches the minimum touch target when no neighbour limits it', () => {
    const box = switchHitBox({});
    expect(
      DESIGN_TOG.width + box.paddingLeft + box.paddingRight,
    ).toBeGreaterThanOrEqual(minTouchTargetDp);
    expect(
      DESIGN_TOG.height + box.paddingTop + box.paddingBottom,
    ).toBeGreaterThanOrEqual(minTouchTargetDp);
    expect(box.marginLeft).toBe(-box.paddingLeft);
    expect(box.marginTop).toBe(-box.paddingTop);
  });

  it('splits explicit gaps and hands every side back as margin', () => {
    const gaps = { top: 20, bottom: 8, left: 10, right: 0 };
    const box = switchHitBox(gaps);
    expect(box).toEqual({
      paddingTop: gaps.top / 2,
      paddingRight: gaps.right,
      paddingBottom: gaps.bottom / 2,
      paddingLeft: gaps.left / 2,
      marginTop: -gaps.top / 2,
      marginRight: -gaps.right,
      marginBottom: -gaps.bottom / 2,
      marginLeft: -gaps.left / 2,
    });
  });
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
