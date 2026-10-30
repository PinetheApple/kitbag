import {
  BarIconButton,
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  Icon,
  lineRatio,
  metronome,
  metronomeMix,
  minTouchTargetDp,
  mixHex,
  radius,
  screenBar,
  size,
  space,
  textRoles,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import {
  adjacentEntry,
  SONG_STEP,
  useLibrary,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  activeSetOf,
  setlistChipA11yLabel,
  setlistChipLabel,
  songChipA11yLabel,
  soloChipText,
  stageChipText,
  stepA11yLabel,
  type ActiveSet,
  type SongChipText,
} from '../logic/setlistChip.ts';
import { SetlistSongsSheet } from './SetlistSongsSheet.tsx';

const NO_ENTRIES: readonly SetlistEntry[] = [];
const BAR_BLEED = screenBar.h - space.screenInset;

function chipToBody(chipHeight: number): number {
  return (metronome.appBar - chipHeight) / 2 + metronome.belowAppBar;
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
  bar: {
    minHeight: metronome.appBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: screenBar.gap,
    paddingHorizontal: screenBar.h,
    marginHorizontal: BAR_BLEED,
  },
  stageBar: {
    gap: 0,
  },
  title: {
    ...textStyle(textRoles.appBarTitle),
    lineHeight: textRoles.appBarTitle.size * lineRatio.appBarTitle,
    color: theme.color.text,
    flex: 1,
    minWidth: 0,
  },
  setChipHit: {
    ...SET_CHIP_HIT_BOX,
    flexShrink: 1,
    marginRight: SET_CHIP_HIT_BOX.marginRight + metronome.setChipEnd,
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
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      metronomeMix.setChip,
    ),
  },
  lines: {
    flexShrink: 1,
    minWidth: 0,
  },
  stageLines: {
    flex: 1,
  },
  songTitle: {
    ...textStyle(textRoles.songChipTitle),
    lineHeight: textRoles.songChipTitle.size * metronome.songChipLineHeight,
    color: theme.color.text,
  },
  songContext: {
    ...textStyle(textRoles.songChipContext),
    lineHeight: textRoles.songChipContext.size * metronome.songChipLineHeight,
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
  const loadedItemId = useLibrary((s) => s.loaded?.itemId ?? null);
  const song = useLibrary(
    (s) => s.presets.find((p) => p.id === s.loaded?.presetId)?.name,
  );
  const set = useMemo(
    () => activeSetOf(setlists, allEntries, loadedItemId),
    [setlists, allEntries, loadedItemId],
  );
  const entries =
    set === undefined ? NO_ENTRIES : (allEntries[set.id] ?? NO_ENTRIES);
  return { song, set, entries, loadedItemId };
}

function SongChipFace({
  text,
  stage,
}: {
  readonly text: SongChipText;
  readonly stage: boolean;
}) {
  const styles = useStyles();
  const ink = useTheme().accentInk;
  return (
    <>
      <View style={[styles.lines, stage && styles.stageLines]}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {text.title}
        </Text>
        <Text
          style={[styles.songContext, stage && styles.stageContext]}
          numberOfLines={1}
        >
          {text.context}
        </Text>
      </View>
      <Icon name="caretDown" size="caret" color={stage ? ink : 'text3'} />
    </>
  );
}

interface SongChipProps {
  readonly text: SongChipText;
  readonly label: string;
  readonly hint: string;
  readonly stage: boolean;
  readonly onPress: () => void;
}

function SongChip({ text, label, hint, stage, onPress }: SongChipProps) {
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
        <SongChipFace text={text} stage />
      ) : (
        <View style={face}>
          <SongChipFace text={text} stage={false} />
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
        <Icon name="caretDown" size="caret" color="text3" />
      </View>
    </Pressable>
  );
}

function BackButton({ onBack }: { readonly onBack: () => void }) {
  return (
    <BarIconButton
      icon="arrowBack"
      label="Back"
      color="text"
      onPress={onBack}
    />
  );
}

interface StageBarProps {
  readonly context: SongContext & { readonly set: ActiveSet };
  readonly bottomInset: number;
  readonly onBack: (() => void) | undefined;
}

function StageBar({ context, bottomInset, onBack }: StageBarProps) {
  const styles = useStyles();
  const { song, set, entries, loadedItemId } = context;
  const stepSong = useLibrary((s) => s.stepSong);
  const [listOpen, setListOpen] = useState(false);
  const previous = adjacentEntry(entries, loadedItemId, SONG_STEP.previous);
  const next = adjacentEntry(entries, loadedItemId, SONG_STEP.next);
  const handlePrevious = useCallback(() => {
    void stepSong(SONG_STEP.previous);
  }, [stepSong]);
  const handleNext = useCallback(() => {
    void stepSong(SONG_STEP.next);
  }, [stepSong]);
  const handleOpenList = useCallback(() => {
    setListOpen(true);
  }, []);
  const handleCloseList = useCallback(() => {
    setListOpen(false);
  }, []);
  return (
    <View style={[styles.bar, styles.stageBar]}>
      {onBack === undefined ? null : <BackButton onBack={onBack} />}
      <BarIconButton
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
        label={songChipA11yLabel(song, set)}
        hint="Opens the song list"
        onPress={handleOpenList}
      />
      <BarIconButton
        icon="next"
        size="skip"
        color="text"
        label={stepA11yLabel(SONG_STEP.next, next)}
        disabled={next === undefined}
        onPress={handleNext}
      />
      <SetlistSongsSheet
        visible={listOpen}
        set={set}
        bottomInset={bottomInset}
        onDismiss={handleCloseList}
      />
    </View>
  );
}

interface PlainBarProps {
  readonly song: string | undefined;
  readonly onBack: (() => void) | undefined;
  readonly onOpenSetlists: (() => void) | undefined;
}

function PlainBar({ song, onBack, onOpenSetlists }: PlainBarProps) {
  const styles = useStyles();
  const text = soloChipText(song);
  return (
    <View style={styles.bar}>
      {onBack === undefined ? null : <BackButton onBack={onBack} />}
      <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
        Metronome
      </Text>
      {onOpenSetlists === undefined ? null : text === undefined ? (
        <SetlistsChip onPress={onOpenSetlists} />
      ) : (
        <SongChip
          stage={false}
          text={text}
          label={songChipA11yLabel(song, undefined)}
          hint="Opens setlists"
          onPress={onOpenSetlists}
        />
      )}
    </View>
  );
}

interface MetronomeAppBarProps {
  readonly bottomInset: number;
  readonly onBack?: (() => void) | undefined;
  readonly onOpenSetlists?: (() => void) | undefined;
}

export function MetronomeAppBar({
  bottomInset,
  onBack,
  onOpenSetlists,
}: MetronomeAppBarProps) {
  const context = useSongContext();
  const { set } = context;
  if (set !== undefined)
    return (
      <StageBar
        context={{ ...context, set }}
        bottomInset={bottomInset}
        onBack={onBack}
      />
    );
  return (
    <PlainBar
      song={context.song}
      onBack={onBack}
      onOpenSetlists={onOpenSetlists}
    />
  );
}
