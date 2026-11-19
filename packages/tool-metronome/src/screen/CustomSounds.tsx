import {
  BarIconButton,
  Button,
  Card,
  createThemedStyles,
  LinearProgress,
  PickerTile,
  SectionHeader,
  SheetHint,
  space,
  textRoles,
  textStyle,
  useTextScaled,
} from '@kitbag/core-design';
import { customSoundId, KB_CUSTOM_SOUND_SLOTS } from '@kitbag/core-native';
import { useClickSounds, type ClickSound } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  clickSoundNoticeView,
  IMPORT_LABEL,
  importHint,
  optionsLabel,
  preparingText,
  tileLabel,
  unavailableText,
  YOUR_SOUNDS,
} from '../logic/customSoundText.ts';
import {
  customSoundViews,
  type CustomSoundView,
} from '../logic/soundChoice.ts';

const useStyles = createThemedStyles((theme) => ({
  block: { gap: space.sectionGap },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  tile: { flex: 1, minWidth: 0 },
  cardBody: { gap: space.controlGap, alignItems: 'flex-start' },
  preparing: { gap: space.controlGap },
  cardText: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

export function useCustomSoundViews(): readonly CustomSoundView[] {
  const sounds = useClickSounds((s) => s.sounds);
  const unavailable = useClickSounds((s) => s.unavailable);
  return useMemo(
    () => customSoundViews(sounds, unavailable),
    [sounds, unavailable],
  );
}

export function useImportHint(): string {
  const formats = useClickSounds((s) => s.formats);
  const full = useClickSounds((s) => s.sounds.length >= KB_CUSTOM_SOUND_SLOTS);
  return importHint(formats, full);
}

function NoticeCard() {
  const styles = useStyles();
  const notice = useClickSounds((s) => s.notice);
  const dismiss = useClickSounds((s) => s.dismissNotice);
  if (notice === null) return null;
  const { text, tone, status } = clickSoundNoticeView(notice);
  return (
    <Card emphasis={tone} statusIcon="warning" statusLabel={status}>
      <View style={styles.cardBody}>
        <Text accessibilityLiveRegion="polite" style={styles.cardText}>
          {text}
        </Text>
        <Button label="Dismiss" variant="ghost" onPress={dismiss} />
      </View>
    </Card>
  );
}

function UnavailableCard({ name }: { readonly name: string }) {
  const styles = useStyles();
  return (
    <Card emphasis="warning" statusIcon="warning" statusLabel="Unavailable">
      <Text style={styles.cardText}>{unavailableText(name)}</Text>
    </Card>
  );
}

function PreparingCard({ fileName }: { readonly fileName: string }) {
  const styles = useStyles();
  const text = preparingText(fileName);
  return (
    <Card>
      <View style={styles.preparing}>
        <Text accessibilityLiveRegion="polite" style={styles.cardText}>
          {text}
        </Text>
        <LinearProgress percent={null} accessibilityLabel={text} />
      </View>
    </Card>
  );
}

interface SoundRowProps {
  readonly view: CustomSoundView;
  readonly selected: boolean;
  readonly onPick: (id: number) => void;
  readonly onOptions: (sound: ClickSound) => void;
}

function SoundRow({ view, selected, onPick, onOptions }: SoundRowProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const { id, sound, available } = view;
  const handlePick = useCallback(() => {
    onPick(id);
  }, [onPick, id]);
  const handleOptions = useCallback(() => {
    onOptions(sound);
  }, [onOptions, sound]);
  return (
    <View style={styles.row}>
      <PickerTile
        label={sound.name}
        accessibilityLabel={tileLabel(sound.name, available)}
        selected={selected && available}
        disabled={!available}
        oneLine={!scaled}
        style={styles.tile}
        onPress={handlePick}
      />
      <BarIconButton
        icon="more"
        label={optionsLabel(sound.name)}
        onPress={handleOptions}
      />
    </View>
  );
}

export interface CustomSoundsProps {
  readonly selected: number;
  readonly showHint: boolean;
  readonly onPick: (id: number) => void;
  readonly onImported: (id: number) => void;
  readonly onOptions: (sound: ClickSound) => void;
}

export function CustomSounds({
  selected,
  showHint,
  onPick,
  onImported,
  onOptions,
}: CustomSoundsProps) {
  const styles = useStyles();
  const views = useCustomSoundViews();
  const hint = useImportHint();
  const preparing = useClickSounds((s) => s.preparing);
  const importPicked = useClickSounds((s) => s.importPicked);
  const full = views.length >= KB_CUSTOM_SOUND_SLOTS;
  const handleImport = useCallback(() => {
    void importPicked(null).then((sound) => {
      if (sound !== null) onImported(customSoundId(sound.slot));
    });
  }, [importPicked, onImported]);
  return (
    <View style={styles.block}>
      <SectionHeader label={YOUR_SOUNDS} />
      {views
        .filter((view) => !view.available)
        .map((view) => (
          <UnavailableCard key={view.sound.uuid} name={view.sound.name} />
        ))}
      <NoticeCard />
      {views.map((view) => (
        <SoundRow
          key={view.sound.slot}
          view={view}
          selected={view.id === selected}
          onPick={onPick}
          onOptions={onOptions}
        />
      ))}
      {preparing !== null ? (
        <PreparingCard fileName={preparing} />
      ) : full ? null : (
        <Button
          label={IMPORT_LABEL}
          variant="tonal"
          size="sheet"
          icon="add"
          iconSize="control"
          onPress={handleImport}
        />
      )}
      {showHint ? <SheetHint>{hint}</SheetHint> : null}
    </View>
  );
}
