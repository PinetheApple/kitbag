import {
  createThemedStyles,
  size,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { Pressable, Text, View } from 'react-native';

import { MUTE_HIT_BOX, SOLO_HIT_BOX } from './stemStyles.ts';

export type ToggleKind = 'mute' | 'solo';

const LETTERS: Readonly<Record<ToggleKind, string>> = { mute: 'M', solo: 'S' };

const useStyles = createThemedStyles((theme) => ({
  toggle: {
    minWidth: stemPlayer.toggle,
    minHeight: stemPlayer.toggle,
    borderRadius: stemPlayer.toggleRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...textStyle(textRoles.stemToggle), color: theme.color.text2 },
  muteOn: { backgroundColor: theme.color.red, borderColor: theme.color.red },
  muteOnText: { color: theme.onDanger },
  soloOn: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  soloOnText: { color: theme.color.onAccent },
}));

interface StemToggleProps {
  readonly kind: ToggleKind;
  readonly on: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
}

export function StemToggle(props: StemToggleProps) {
  const styles = useStyles();
  const mute = props.kind === 'mute';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={props.label}
      accessibilityState={{ checked: props.on }}
      style={mute ? MUTE_HIT_BOX : SOLO_HIT_BOX}
      onPress={props.onPress}
      {...(props.onLongPress === undefined
        ? {}
        : { onLongPress: props.onLongPress })}
    >
      <View
        style={[
          styles.toggle,
          props.on && (mute ? styles.muteOn : styles.soloOn),
        ]}
      >
        <Text
          style={[
            styles.text,
            props.on && (mute ? styles.muteOnText : styles.soloOnText),
          ]}
        >
          {LETTERS[props.kind]}
        </Text>
      </View>
    </Pressable>
  );
}
