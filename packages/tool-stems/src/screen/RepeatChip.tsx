import { Chip, QUEUE_TEXT, type IconName } from '@kitbag/core-design';
import {
  cycleRepeat,
  REPEAT,
  useRepeatMode,
  type RepeatMode,
} from '@kitbag/core-state';

interface RepeatFace {
  readonly icon: IconName;
  readonly label: string;
}

const REPEAT_FACES: Readonly<Record<RepeatMode, RepeatFace>> = {
  off: { icon: 'repeatOff', label: QUEUE_TEXT.repeatOff },
  all: { icon: 'repeat', label: QUEUE_TEXT.repeatAll },
  one: { icon: 'repeatOne', label: QUEUE_TEXT.repeatOne },
};

export function RepeatChip() {
  const mode = useRepeatMode();
  const { icon, label } = REPEAT_FACES[mode];
  return (
    <Chip
      label={label}
      icon={icon}
      active={mode !== REPEAT.off}
      onPress={cycleRepeat}
    />
  );
}
