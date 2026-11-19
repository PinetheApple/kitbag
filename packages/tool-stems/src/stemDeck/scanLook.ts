import {
  inkOnScrim,
  minTouchTargetDp,
  palette,
  scanner,
  screenBar,
  textRoles,
  useTheme,
} from '@kitbag/core-design';
import type { StemDeckScanLook } from '@kitbag/core-native';
import { useMemo } from 'react';

export const SCAN_TITLE = 'Scan QR code';
export const TYPE_ADDRESS = 'Type the address instead';
const SCAN_PROMPT = 'Point at the QR code in StemDeck’s Settings';
const BACK = 'Back';

export function useScanLook(): StemDeckScanLook {
  const theme = useTheme();
  return useMemo(
    () => ({
      title: SCAN_TITLE,
      prompt: SCAN_PROMPT,
      typeAddress: TYPE_ADDRESS,
      backLabel: BACK,
      barColor: theme.color.bg,
      barInk: theme.color.text,
      actionInk: theme.color[theme.accentInk],
      scrimColor: palette.bg.dark,
      scrimOpacity: scanner.scrimOpacity,
      promptInk: inkOnScrim,
      cornerColor: theme.color.accent,
      frameDp: scanner.frame,
      cornerDp: scanner.corner,
      strokeDp: scanner.stroke,
      cornerRadiusDp: scanner.cornerRadius,
      promptGapDp: scanner.promptGap,
      promptInsetDp: scanner.promptInset,
      barHeightDp: screenBar.height,
      touchTargetDp: minTouchTargetDp,
      titleSp: textRoles.appBarTitle.size,
      actionSp: textRoles.button.size,
      promptSp: scanner.promptSize,
    }),
    [theme],
  );
}
