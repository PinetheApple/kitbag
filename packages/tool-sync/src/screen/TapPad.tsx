import {
  Icon,
  TapLeds as Leds,
  TapPad as Pad,
  useTheme,
} from '@kitbag/core-design';
import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import type { GestureResponderEvent } from 'react-native';

import { TAP_PAD_MODE, type TapPadCopy } from '../logic/tapPad.ts';

export function TapLeds({ landed }: { readonly landed: number }) {
  return <Leds landed={landed} total={TAPS_TO_SET_TEMPO} />;
}

export interface TapPadProps {
  readonly copy: TapPadCopy;
  readonly tapsLanded: number;
  readonly onTap: (event: GestureResponderEvent) => void;
  readonly onRelease: () => void;
  readonly minHeight?: number | null;
}

export function TapPad({
  copy,
  tapsLanded,
  onTap,
  onRelease,
  minHeight,
}: TapPadProps) {
  const theme = useTheme();
  return (
    <Pad
      title={copy.title}
      hint={copy.hint}
      onTap={onTap}
      onRelease={onRelease}
      minHeight={minHeight}
    >
      {copy.mode === TAP_PAD_MODE.tempo ? (
        <TapLeds landed={tapsLanded} />
      ) : (
        <Icon name="tapAlong" size="retimePad" color={theme.accentInk} />
      )}
    </Pad>
  );
}
