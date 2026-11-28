import {
  Button,
  createThemedStyles,
  Icon,
  tapPad,
  TapBadge,
  TapLeds as Leds,
  TapPad as Pad,
  useTextScaled,
  useTheme,
  type IconName,
  type TapBadgeProps,
} from '@kitbag/core-design';
import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import type { GestureResponderEvent } from 'react-native';
import { View } from 'react-native';

import { PAD_ACTION, type PadAction } from '../logic/tapAlongCopy.ts';
import type { TapPadCopy } from '../logic/tapPad.ts';

const ACTION_LABEL: Record<PadAction, string> = {
  [PAD_ACTION.accentRight]: 'The accent is right',
  [PAD_ACTION.startOver]: 'Start over',
};

const ACTION_ICON: Record<PadAction, IconName> = {
  [PAD_ACTION.accentRight]: 'check',
  [PAD_ACTION.startOver]: 'reset',
};

const useStyles = createThemedStyles(() => ({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tapPad.badgeGap,
  },
}));

interface TapLedsProps {
  readonly landed: number;
  readonly out?: number;
}

export function TapLeds({ landed, out = 0 }: TapLedsProps) {
  return <Leds landed={landed} total={TAPS_TO_SET_TEMPO} out={out} />;
}

function TapBadges({
  badges,
}: {
  readonly badges: readonly Required<TapBadgeProps>[];
}) {
  const styles = useStyles();
  const scaled = useTextScaled();
  if (scaled || badges.length === 0) return null;
  return (
    <View style={styles.badges}>
      {badges.map((badge, index) => (
        <TapBadge key={index} label={badge.label} ignored={badge.ignored} />
      ))}
    </View>
  );
}

interface FooterProps {
  readonly copy: TapPadCopy;
  readonly onAction: () => void;
}

function PadFooter({ copy, onAction }: FooterProps) {
  return (
    <>
      <TapBadges badges={copy.badges} />
      {copy.action === null ? null : (
        <Button
          variant="ghost"
          size="prompt"
          icon={ACTION_ICON[copy.action]}
          label={ACTION_LABEL[copy.action]}
          onPress={onAction}
        />
      )}
    </>
  );
}

export interface TapPadProps extends FooterProps {
  readonly onTap: (event: GestureResponderEvent) => void;
  readonly onRelease: () => void;
  readonly minHeight?: number | null;
}

export function TapPad({
  copy,
  onTap,
  onAction,
  onRelease,
  minHeight,
}: TapPadProps) {
  const theme = useTheme();
  return (
    <Pad
      title={copy.title}
      hint={copy.hint}
      active={copy.active}
      footer={<PadFooter copy={copy} onAction={onAction} />}
      onTap={onTap}
      onRelease={onRelease}
      minHeight={minHeight}
    >
      {copy.leds === null ? (
        <Icon name="tapAlong" size="retimePad" color={theme.accentInk} />
      ) : (
        <TapLeds landed={copy.leds} out={copy.ledsOut} />
      )}
    </Pad>
  );
}
