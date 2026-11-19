import {
  BeatLedRow,
  Button,
  PickerGrid,
  SectionHeader,
  SegmentedControl,
  Sheet,
  SheetHint,
} from '@kitbag/core-design';
import { KB_STOPPED_BEAT } from '@kitbag/core-native';
import { useSongPlayer } from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  accentLedLabel,
  accentLedLayout,
  accentLedState,
} from '../logic/accentLeds.ts';
import {
  CLICK_GROUP,
  COUNT_IN_OPTIONS,
  SONG_CLICK_TEXT,
  SOUND_OPTIONS,
  SOUND_ROLE,
  SOUND_ROLE_OPTIONS,
  type ClickGroup,
  type SoundRole,
} from '../logic/clickChipText.ts';

const SAVE_NOT_BUILT = () => undefined;
const LEFT_ALIGNED = { alignSelf: 'flex-start' } as const;

export function useSongClickSheet() {
  const [group, setGroup] = useState<ClickGroup | null>(null);
  const open = useCallback((next: ClickGroup) => {
    setGroup(next);
  }, []);
  const close = useCallback(() => {
    setGroup(null);
  }, []);
  return { group, open, close };
}

interface GroupHeaderProps {
  readonly label: string;
  readonly headerRef: RefObject<View | null>;
}

function GroupHeader({ label, headerRef }: GroupHeaderProps) {
  return (
    <View ref={headerRef} accessible accessibilityLabel={label}>
      <SectionHeader label={label} />
    </View>
  );
}

function CountInGroup({ headerRef }: Pick<GroupHeaderProps, 'headerRef'>) {
  const bars = useSongPlayer((s) => s.clickSettings.countInBars);
  const setCountIn = useSongPlayer((s) => s.setClickCountIn);
  const select = useCallback(
    (value: string) => {
      setCountIn(Number(value));
    },
    [setCountIn],
  );
  return (
    <>
      <GroupHeader label={SONG_CLICK_TEXT.countIn} headerRef={headerRef} />
      <SegmentedControl
        fill
        accessibilityLabel={SONG_CLICK_TEXT.countIn}
        options={COUNT_IN_OPTIONS}
        selected={String(bars)}
        onSelect={select}
      />
      <SheetHint>{SONG_CLICK_TEXT.countInNote}</SheetHint>
    </>
  );
}

function SoundGroup({ headerRef }: Pick<GroupHeaderProps, 'headerRef'>) {
  const [role, setRole] = useState<SoundRole>(SOUND_ROLE.normal);
  const sounds = useSongPlayer((s) => s.clickSettings.sounds);
  const setSounds = useSongPlayer((s) => s.setClickSounds);
  const pick = useCallback(
    (value: string) => {
      const id = Number(value);
      if (role === SOUND_ROLE.accent) setSounds(sounds.normal, id);
      else setSounds(id, sounds.accent);
    },
    [role, setSounds, sounds],
  );
  return (
    <>
      <GroupHeader label={SONG_CLICK_TEXT.sound} headerRef={headerRef} />
      <SegmentedControl
        fill
        accessibilityLabel={SONG_CLICK_TEXT.soundRole}
        options={SOUND_ROLE_OPTIONS}
        selected={role}
        onSelect={setRole}
      />
      <PickerGrid
        accessibilityLabel={`${role} beat sound`}
        options={SOUND_OPTIONS}
        selected={String(sounds[role])}
        onSelect={pick}
      />
    </>
  );
}

function AccentsGroup({ headerRef }: Pick<GroupHeaderProps, 'headerRef'>) {
  const silent = useSharedValue(KB_STOPPED_BEAT);
  const accents = useSongPlayer((s) => s.clickSettings.accents);
  const cycle = useSongPlayer((s) => s.cycleClickAccent);
  const layout = useMemo(() => accentLedLayout(accents.length), [accents]);
  const states = useMemo(() => accents.map(accentLedState), [accents]);
  return (
    <>
      <GroupHeader label={SONG_CLICK_TEXT.accents} headerRef={headerRef} />
      <View style={LEFT_ALIGNED}>
        <BeatLedRow
          layout={layout}
          states={states}
          activeBeat={silent}
          ledLabel={accentLedLabel}
          onPressBeat={cycle}
        />
      </View>
      <SheetHint>{SONG_CLICK_TEXT.accentsHint}</SheetHint>
    </>
  );
}

export interface SongClickSheetProps {
  readonly group: ClickGroup | null;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function SongClickSheet({
  group,
  bottomInset,
  onDismiss,
}: SongClickSheetProps) {
  const countInRef = useRef<View>(null);
  const soundRef = useRef<View>(null);
  const accentsRef = useRef<View>(null);
  const focusRefs = {
    [CLICK_GROUP.countIn]: countInRef,
    [CLICK_GROUP.sound]: soundRef,
    [CLICK_GROUP.accents]: accentsRef,
  };
  return (
    <Sheet
      visible={group !== null}
      title={SONG_CLICK_TEXT.title}
      dismissLabel={SONG_CLICK_TEXT.dismiss}
      bottomInset={bottomInset}
      {...(group === null ? {} : { initialFocusRef: focusRefs[group] })}
      onDismiss={onDismiss}
    >
      <CountInGroup headerRef={countInRef} />
      <SoundGroup headerRef={soundRef} />
      <AccentsGroup headerRef={accentsRef} />
      <Button
        variant="primary"
        size="sheet"
        label={SONG_CLICK_TEXT.save}
        disabled
        onPress={SAVE_NOT_BUILT}
      />
    </Sheet>
  );
}
