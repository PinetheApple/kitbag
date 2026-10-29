import {
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  Icon,
  inset,
  minTouchTargetDp,
  PickerGrid,
  radius,
  Sheet,
  size,
  space,
  textRoles,
  textStyle,
  TransportKey,
} from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  SOUND_OPTIONS,
  SOUND_ROLE,
  soundLabel,
  soundRoleName,
  soundsWith,
  type SoundRole,
} from '../logic/soundChoice.ts';
import { PracticeSection, usePracticeStyles } from './PracticeSection.tsx';

const PICK_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, size.soundPick, {
    top: space.controlGap,
    bottom: space.controlGap,
  }),
);

const useStyles = createThemedStyles((theme) => ({
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
    minHeight: size.soundPick,
    paddingLeft: inset.soundPickLeft,
    paddingRight: inset.soundPickRight,
    borderRadius: radius.pick,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  pickLabel: {
    ...textStyle(textRoles.soundPick),
    color: theme.color.text,
  },
}));

interface SoundRowProps {
  readonly role: SoundRole;
  readonly onOpen: (role: SoundRole) => void;
}

function SoundRow({ role, onOpen }: SoundRowProps) {
  const styles = useStyles();
  const practiceStyles = usePracticeStyles();
  const sound = useMetronome((s) => s.sounds[role]);
  const previewSound = useMetronome((s) => s.previewSound);
  const name = soundLabel(sound);
  const handleOpen = useCallback(() => {
    onOpen(role);
  }, [onOpen, role]);
  const handlePreview = useCallback(() => {
    previewSound(sound, role === SOUND_ROLE.accent);
  }, [previewSound, sound, role]);
  return (
    <View style={practiceStyles.row}>
      <Text style={practiceStyles.label}>{soundRoleName(role)}</Text>
      <View style={practiceStyles.grow} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${soundRoleName(role)} sound, ${name}`}
        accessibilityHint="Changes the sound"
        style={PICK_HIT_BOX}
        onPress={handleOpen}
      >
        <View style={styles.pick}>
          <Text style={styles.pickLabel}>{name}</Text>
          <Icon name="caretDown" size="caret" color="text2" />
        </View>
      </Pressable>
      <TransportKey
        size="small"
        icon="play"
        accessibilityLabel={`Preview ${soundRoleName(role).toLowerCase()} sound`}
        onPress={handlePreview}
      />
    </View>
  );
}

export function PracticeSound({
  onOpen,
}: {
  readonly onOpen: (role: SoundRole) => void;
}) {
  return (
    <PracticeSection icon="metronome" title="Sound">
      <SoundRow role={SOUND_ROLE.normal} onOpen={onOpen} />
      <SoundRow role={SOUND_ROLE.accent} onOpen={onOpen} />
    </PracticeSection>
  );
}

interface SoundListSheetProps {
  readonly role: SoundRole | null;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function SoundListSheet({
  role,
  bottomInset,
  onDismiss,
}: SoundListSheetProps) {
  const sounds = useMetronome((s) => s.sounds);
  const setSounds = useMetronome((s) => s.setSounds);
  const previewSound = useMetronome((s) => s.previewSound);
  const shownRole = role ?? SOUND_ROLE.normal;
  const handlePick = useCallback(
    (value: string) => {
      const id = Number(value);
      const next = soundsWith(sounds, shownRole, id);
      setSounds(next.normal, next.accent);
      previewSound(id, shownRole === SOUND_ROLE.accent);
      onDismiss();
    },
    [sounds, shownRole, setSounds, previewSound, onDismiss],
  );
  return (
    <Sheet
      visible={role !== null}
      title={`${soundRoleName(shownRole)} sound`}
      dismissLabel={`Close ${soundRoleName(shownRole).toLowerCase()} sound`}
      bottomInset={bottomInset}
      dim
      onDismiss={onDismiss}
    >
      <PickerGrid
        accessibilityLabel={`${soundRoleName(shownRole)} beat sound`}
        options={SOUND_OPTIONS}
        selected={String(sounds[shownRole])}
        onSelect={handlePick}
      />
    </Sheet>
  );
}
