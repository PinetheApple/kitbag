import { screenBar } from './roles.ts';

// The badge keeps its design offset from the icon's top-right corner, and
// that offset grows with the icon so the badge covers the same share of it.
export function barBadgePlace(iconPx: number, iconScale: number) {
  const insetAt = (scale: number) =>
    (screenBar.iconButton - iconPx * scale) / 2;
  const designInset = insetAt(1);
  return {
    top: insetAt(iconScale) - (designInset - screenBar.badgeTop) * iconScale,
    right: insetAt(iconScale) - (designInset - screenBar.badgeEnd) * iconScale,
  };
}
