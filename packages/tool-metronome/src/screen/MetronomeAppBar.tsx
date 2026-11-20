import {
  AppBar,
  BarIconButton,
  barChipRoom,
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  Icon,
  lineRatio,
  metronome,
  minTouchTargetDp,
  radius,
  screenBar,
  size,
  space,
  textRoles,
  textStyle,
  useTheme,
  UnsavedDot,
} from '@kitbag/core-design';
import {
  activeSetView,
  entryName,
  REPEAT,
  SONG_STEP,
  stagePositionOf,
  steppedEntry,
  stemSongTitle,
  useLibrary,
  useRepeatMode,
  useStemSongs,
  type ActiveSet,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  loadedSongName,
  setlistChipA11yLabel,
  setlistChipLabel,
  soloChipA11yLabel,
  soloChipText,
  stageChipA11yLabel,
  stageChipText,
  stepA11yLabel,
  type SongChipText,
} from '../logic/setlistChip.ts';
import { LoadedSongSheet } from './LoadedSongSheet.tsx';
import { useStepSong, type StemStepHandlers } from './useStepSong.ts';
import { SetlistSongsSheet } from './SetlistSongsSheet.tsx';
import { useLoadedSongUnsaved } from './UnsavedChanges.tsx';

const NO_ENTRIES: readonly SetlistEntry[] = [];

function chipToBody(chipHeight: number): number {
  return barChipRoom(chipHeight) + metronome.belowAppBar;
}

const SET_CHIP_HIT_BOX = hitBoxStyle(
  hitExtension(metronome.setChip, metronome.setChip, {
    top: chipToBody(metronome.setChip),
    bottom: chipToBody(metronome.setChip),
  }),
);
const SONG_CHIP_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, metronome.songChipPlain, {
    top: chipToBody(metronome.songChipPlain),
    bottom: chipToBody(metronome.songChipPlain),
  }),
);

const useStyles = createThemedStyles((theme) => ({
  setChipHit: {
    ...SET_CHIP_HIT_BOX,
    flexShrink: 1,
    marginRight: SET_CHIP_HIT_BOX.marginRight + screenBar.chipEnd,
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: space.inlineKeyGap,
    minHeight: metronome.setChip,
    paddingLeft: metronome.setChipLeft,
    paddingRight: metronome.setChipRight,
    borderRadius: radius.chip,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  setLabel: {
    ...textStyle(textRoles.setChip),
    color: theme.color.text,
    flexShrink: 1,
  },
  plainChipHit: {
    ...SONG_CHIP_HIT_BOX,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: metronome.songChipPlainMax,
    marginRight: SONG_CHIP_HIT_BOX.marginRight + metronome.songChipPlainEnd,
  },
  songChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: metronome.songChipGap,
    paddingLeft: metronome.songChipLeft,
    paddingRight: metronome.songChipRight,
    borderRadius: metronome.songChipRadius,
    borderWidth: size.stroke,
  },
  plainChip: {
    minHeight: metronome.songChipPlain,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  stageChip: {
    flex: 1,
    minWidth: 0,
    minHeight: metronome.songChip,
    borderColor: theme.color.accentDim,
    backgroundColor: theme.setChipFill,
  },
  lines: {
    flexShrink: 1,
    minWidth: 0,
  },
  stageLines: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: metronome.unsavedDotGap,
  },
  songTitle: {
    flexShrink: 1,
    ...textStyle(textRoles.songChipTitle),
    lineHeight: textRoles.songChipTitle.size * lineRatio.songChip,
    color: theme.color.text,
  },
  songContext: {
    ...textStyle(textRoles.songChipContext),
    lineHeight: textRoles.songChipContext.size * lineRatio.songChip,
    color: theme.color.text2,
  },
  stageContext: {
    color: theme.color[theme.accentInk],
  },
}));

interface SongContext {
  readonly song: string | undefined;
  readonly set: ActiveSet | undefined;
  readonly entries: readonly SetlistEntry[];
  readonly loadedItemId: number | null;
}

function useSongContext(): SongContext {
  const setlists = useLibrary((s) => s.setlists);
  const allEntries = useLibrary((s) => s.entries);
  const loaded = useLibrary((s) => s.loaded);
  const loadedItemId = loaded?.itemId ?? null;
  const preset = useLibrary((s) => loadedSongName(s.presets, s.loaded));
  const stems = useStemSongs();
  const song =
    loaded !== null && loaded.presetId === null
      ? stemSongTitle(loaded.stemSetId, stems)
      : preset;
  const set = useMemo(
    () => activeSetView(setlists, allEntries, loaded),
    [setlists, allEntries, loaded],
  );
  const entries =
    set === undefined ? NO_ENTRIES : (allEntries[set.id] ?? NO_ENTRIES);
  return { song, set, entries, loadedItemId };
}

function SongChipFace({
  text,
  stage,
  unsaved,
}: {
  readonly text: SongChipText;
  readonly stage: boolean;
  readonly unsaved: boolean;
}) {
  const styles = useStyles();
  const ink = useTheme().accentInk;
  return (
    <>
      <View style={[styles.lines, stage && styles.stageLines]}>
        <View style={styles.titleLine}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {text.title}
          </Text>
          {unsaved ? <UnsavedDot /> : null}
        </View>
        <Text
          style={[styles.songContext, stage && styles.stageContext]}
          numberOfLines={1}
        >
          {text.context}
        </Text>
      </View>
      <Icon name="caretDown" size="caret" color={stage ? ink : 'decor'} />
    </>
  );
}

interface SongChipProps {
  readonly text: SongChipText;
  readonly label: string;
  readonly hint: string;
  readonly stage: boolean;
  readonly unsaved: boolean;
  readonly onPress: () => void;
}

function SongChip({
  text,
  label,
  hint,
  stage,
  unsaved,
  onPress,
}: SongChipProps) {
  const styles = useStyles();
  const face = [styles.songChip, stage ? styles.stageChip : styles.plainChip];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={stage ? face : styles.plainChipHit}
      onPress={onPress}
    >
      {stage ? (
        <SongChipFace text={text} stage unsaved={unsaved} />
      ) : (
        <View style={face}>
          <SongChipFace text={text} stage={false} unsaved={unsaved} />
        </View>
      )}
    </Pressable>
  );
}

function SetlistsChip({ onPress }: { readonly onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={setlistChipA11yLabel(undefined)}
      accessibilityHint="Opens setlists"
      style={styles.setChipHit}
      onPress={onPress}
    >
      <View style={styles.setChip}>
        <Text style={styles.setLabel} numberOfLines={1}>
          {setlistChipLabel(undefined)}
        </Text>
        <Icon name="caretDown" size="caret" color="decor" />
      </View>
    </Pressable>
  );
}

function useStepTargets(context: SongContext & { readonly set: ActiveSet }) {
  const { entries, set } = context;
  const loaded = useLibrary((s) => s.loaded);
  const stems = useStemSongs();
  const nameOf = (entry: SetlistEntry | undefined) =>
    entry === undefined ? undefined : entryName(entry, stems);
  const wraps = useRepeatMode() === REPEAT.all;
  const position = stagePositionOf(loaded, set.id);
  const previous = steppedEntry(entries, position, SONG_STEP.previous, wraps);
  const next = steppedEntry(entries, position, SONG_STEP.next, wraps);
  return { previous: nameOf(previous), next: nameOf(next) };
}

interface StageBarProps extends StemStepHandlers {
  readonly context: SongContext & { readonly set: ActiveSet };
  readonly bottomInset: number;
  readonly onBack: (() => void) | undefined;
}

function StageBar({
  context,
  bottomInset,
  onBack,
  ...handlers
}: StageBarProps) {
  const { song, set } = context;
  const step = useStepSong(handlers);
  const [listOpen, setListOpen] = useState(false);
  const { previous, next } = useStepTargets(context);
  const handlePrevious = useCallback(() => {
    void step(SONG_STEP.previous);
  }, [step]);
  const handleNext = useCallback(() => {
    void step(SONG_STEP.next);
  }, [step]);
  const handleOpenList = useCallback(() => {
    setListOpen(true);
  }, []);
  const handleCloseList = useCallback(() => {
    setListOpen(false);
  }, []);
  const unsaved = useLoadedSongUnsaved();
  return (
    <>
      <AppBar packed onBack={onBack}>
        <BarIconButton
          filled
          icon="previous"
          size="skip"
          color="text"
          label={stepA11yLabel(SONG_STEP.previous, previous)}
          disabled={previous === undefined}
          onPress={handlePrevious}
        />
        <SongChip
          stage
          text={stageChipText(song, set)}
          label={stageChipA11yLabel(song, set, unsaved)}
          hint="Opens the song list"
          unsaved={unsaved}
          onPress={handleOpenList}
        />
        <BarIconButton
          filled
          icon="next"
          size="skip"
          color="text"
          label={stepA11yLabel(SONG_STEP.next, next)}
          disabled={next === undefined}
          onPress={handleNext}
        />
      </AppBar>
      <SetlistSongsSheet
        visible={listOpen}
        set={set}
        bottomInset={bottomInset}
        onDismiss={handleCloseList}
        onOpenStemSet={handlers.onOpenStemSet}
      />
    </>
  );
}

interface PlainBarProps {
  readonly song: string | undefined;
  readonly bottomInset: number;
  readonly onBack: (() => void) | undefined;
  readonly onOpenSetlists: (() => void) | undefined;
}

function PlainBar({
  song,
  bottomInset,
  onBack,
  onOpenSetlists,
}: PlainBarProps) {
  const [songOpen, setSongOpen] = useState(false);
  const handleOpenSong = useCallback(() => {
    setSongOpen(true);
  }, []);
  const handleCloseSong = useCallback(() => {
    setSongOpen(false);
  }, []);
  const unsaved = useLoadedSongUnsaved();
  const text = soloChipText(song);
  const songChip =
    text === undefined ? undefined : (
      <SongChip
        stage={false}
        text={text}
        label={soloChipA11yLabel(text.title, unsaved)}
        hint="Opens the song"
        unsaved={unsaved}
        onPress={handleOpenSong}
      />
    );
  const setlistsChip =
    onOpenSetlists === undefined ? undefined : (
      <SetlistsChip onPress={onOpenSetlists} />
    );
  return (
    <>
      <AppBar
        title="Metronome"
        onBack={onBack}
        trailing={songChip ?? setlistsChip}
      />
      {text === undefined ? null : (
        <LoadedSongSheet
          visible={songOpen}
          song={text.title}
          bottomInset={bottomInset}
          onDismiss={handleCloseSong}
          onOpenSetlists={onOpenSetlists}
        />
      )}
    </>
  );
}

interface MetronomeAppBarProps extends StemStepHandlers {
  readonly bottomInset: number;
  readonly onBack?: (() => void) | undefined;
  readonly onOpenSetlists?: (() => void) | undefined;
}

export function MetronomeAppBar({
  bottomInset,
  onBack,
  onOpenSetlists,
  onOpenStemSet,
  onSkipped,
}: MetronomeAppBarProps) {
  const context = useSongContext();
  const { set } = context;
  if (set !== undefined)
    return (
      <StageBar
        context={{ ...context, set }}
        bottomInset={bottomInset}
        onBack={onBack}
        onOpenStemSet={onOpenStemSet}
        onSkipped={onSkipped}
      />
    );
  return (
    <PlainBar
      song={context.song}
      bottomInset={bottomInset}
      onBack={onBack}
      onOpenSetlists={onOpenSetlists}
    />
  );
}
