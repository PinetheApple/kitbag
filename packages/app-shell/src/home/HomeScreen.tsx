import {
  AppBar,
  type AppBarAction,
  Button,
  createThemedStyles,
  screenFrameInsets,
  space,
  ToolGrid,
  ToolRow,
  type ToolGridItem,
} from '@kitbag/core-design';
import {
  pausedMove,
  summarize,
  useDataFolder,
  useHomeLayout,
  useLastTool,
  useMetronome,
  useSongLibrary,
  visibleTiles,
} from '@kitbag/core-state';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompiledTools } from '@/tools/compiledToolsContext';

import { MovePausedBanner } from '../dataFolder/MovePausedBanner.tsx';
import { DockedMiniPlayer } from '../miniPlayer/DockedMiniPlayer.tsx';
import { useAnyMiniPlayerDocked } from '../miniPlayer/useMiniPlayerDocked.ts';
import { useQueueSheet } from '../queue/useQueueSheet.tsx';
import { useSettingsRoutes } from '../settings/settingsRoutes.ts';
import { ArrangeSheet } from './ArrangeSheet.tsx';
import { MoreToolsRow } from './MoreToolsRow.tsx';
import { MoreToolsSheet, type MoreToolsItem } from './MoreToolsSheet.tsx';
import {
  arrangedWithOff,
  moreTools,
  shownArrangement,
  toolFor,
  type HomeArrangement,
} from './arrangement.ts';
import {
  continueTarget,
  HOME_TOOLS,
  hasHomeTile,
  TOOL_ID,
  toolStatus,
  type BuiltTool,
  type HomeToolEntry,
  type ToolOnTest,
} from './registry.ts';
import {
  metronomeResumeSubtitle,
  metronomeTileSubtext,
  songsTileSubtext,
  stemsTileSubtext,
  LIBRARY_UNAVAILABLE_SUBTEXT,
  PLAY_ALONG_SUBTEXT,
  UPCOMING_SUBTEXT,
  type MetronomeSummary,
} from './subtext.ts';
import { useToolOn } from './toolsOn.ts';
import { usePracticeTileText } from './usePracticeTileText.ts';

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.screenInset,
    paddingBottom: space.screenInset,
    gap: space.sectionGap,
  },
}));

interface LiveText {
  readonly tile: string;
  readonly resume: string;
}

function useMetronomeSummary(): MetronomeSummary {
  const bpm = useMetronome((s) => s.bpm);
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const running = useMetronome((s) => s.running);
  const ramp = useMetronome((s) => s.ramp);
  return useMemo(
    () => ({ bpm, beatsPerBar, denominator, running, ramp }),
    [bpm, beatsPerBar, denominator, running, ramp],
  );
}

// Only tools with a store to read get live text; the rest are not built and
// show as upcoming rather than with a made-up number.
function useLiveText(practice: string): Readonly<Record<string, LiveText>> {
  const metronome = useMetronomeSummary();
  const tools = useCompiledTools();
  const tuning = tools.tuner.useHomeSubtext();
  const libraryRows = useSongLibrary((s) => s.rows);
  const libraryFailed = useSongLibrary((s) => s.failed);
  const playAlong = tools.sync.useHomeSubtext() ?? PLAY_ALONG_SUBTEXT;
  return useMemo(() => {
    const library = summarize(libraryRows);
    const songs = libraryFailed
      ? LIBRARY_UNAVAILABLE_SUBTEXT
      : songsTileSubtext(library);
    const stems = libraryFailed
      ? LIBRARY_UNAVAILABLE_SUBTEXT
      : stemsTileSubtext(library);
    return {
      [TOOL_ID.metronome]: {
        tile: metronomeTileSubtext(metronome),
        resume: metronomeResumeSubtitle(metronome),
      },
      [TOOL_ID.tuner]: { tile: tuning, resume: tuning },
      [TOOL_ID.library]: { tile: songs, resume: songs },
      [TOOL_ID.stems]: { tile: stems, resume: stems },
      [TOOL_ID.sync]: { tile: playAlong, resume: playAlong },
      [TOOL_ID.practiceHistory]: { tile: practice, resume: practice },
    };
  }, [metronome, tuning, libraryRows, libraryFailed, playAlong, practice]);
}

function useArrangement(isOn: ToolOnTest) {
  const saved = useHomeLayout((s) => s.arrangement);
  const arrange = useHomeLayout((s) => s.arrange);
  const arrangement = useMemo(
    () => shownArrangement(saved, isOn),
    [saved, isOn],
  );
  const onArrange = useCallback(
    (next: HomeArrangement) => {
      if (next !== arrangement) arrange(arrangedWithOff(saved, next, isOn));
    },
    [arrangement, arrange, saved, isOn],
  );
  return { arrangement, onArrange };
}

export function HomeScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lastToolId = useLastTool((s) => s.toolId);
  const { openSettings } = useSettingsRoutes();
  const isOn = useToolOn();
  const { arrangement, onArrange } = useArrangement(isOn);
  const [moreOpen, setMoreOpen] = useState(false);
  const openMore = useCallback(() => {
    setMoreOpen(true);
  }, []);
  const closeMore = useCallback(() => {
    setMoreOpen(false);
  }, []);
  const more = moreTools(arrangement);
  const practiceListed = [
    ...visibleTiles(arrangement).map((tile) => tile.toolId),
    ...more.map((tool) => tool.id),
  ].includes(TOOL_ID.practiceHistory);
  const liveText = useLiveText(usePracticeTileText(practiceListed));
  const docked = useAnyMiniPlayerDocked();
  const queue = useQueueSheet(insets.bottom);
  const movePaused = useDataFolder((s) => pausedMove(s) !== null);
  const [arranging, setArranging] = useState(false);
  const openArrange = useCallback(() => {
    setArranging(true);
  }, []);
  const closeArrange = useCallback(() => {
    setArranging(false);
  }, []);
  const actions: readonly AppBarAction[] = useMemo(
    () => [{ icon: 'settings', label: 'Settings', onPress: openSettings }],
    [openSettings],
  );

  const frameInset = useMemo(
    () => screenFrameInsets(insets, { dockBelow: docked }),
    [insets, docked],
  );

  const openBuilt = (tool: BuiltTool) => {
    // The registry's route is a plain string (§9.1); typed routes cannot see
    // that it names a file under app/.
    const href = tool.homeTile.route as Href;
    return () => {
      router.push(href);
    };
  };
  const open = (tool: HomeToolEntry) =>
    hasHomeTile(tool) ? openBuilt(tool) : undefined;

  const subtextOf = (tool: HomeToolEntry) =>
    liveText[tool.id]?.tile ?? UPCOMING_SUBTEXT;

  const resume = continueTarget(lastToolId, HOME_TOOLS, isOn);
  const resumeText = resume === undefined ? undefined : liveText[resume.id];
  const resumeRow =
    resume === undefined || resumeText === undefined ? null : (
      <ToolRow
        variant="resume"
        icon={resume.icon}
        title={`Continue · ${resume.name}`}
        subtitle={resumeText.resume}
        status="ready"
        onPress={open(resume)}
      />
    );

  const tiles: ToolGridItem[] = visibleTiles(arrangement).flatMap((tile) => {
    const tool = toolFor(tile);
    if (tool === undefined) return [];
    return [
      {
        id: tool.id,
        size: tile.size,
        icon: tool.icon,
        title: tool.name,
        subtext: subtextOf(tool),
        status: toolStatus(tool),
        onPress: open(tool),
        onLongPress: openArrange,
      },
    ];
  });
  const rows = HOME_TOOLS.filter(
    (tool) => tool.layout === 'row' && isOn(tool.id),
  );
  const moreItems: MoreToolsItem[] = more.map((tool) => ({
    tool,
    subtitle: subtextOf(tool),
    onPress: openBuilt(tool),
  }));

  return (
    <View style={[styles.screen, frameInset]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <AppBar
          wordmark
          title="Kitbag"
          actions={actions}
          trailing={
            <Button
              variant="tonal"
              size="small"
              icon="edit"
              iconSize="field"
              label="Edit"
              accessibilityLabel="Edit Home layout"
              onPress={openArrange}
            />
          }
        />

        {movePaused ? <MovePausedBanner /> : resumeRow}

        <ToolGrid tiles={tiles} />

        {rows.map((tool) => (
          <ToolRow
            key={tool.id}
            icon={tool.icon}
            title={tool.name}
            subtitle={subtextOf(tool)}
            status={toolStatus(tool)}
            onPress={open(tool)}
          />
        ))}

        <MoreToolsRow count={moreItems.length} onPress={openMore} />

        <MoreToolsSheet
          visible={moreOpen}
          items={moreItems}
          bottomInset={insets.bottom}
          onDismiss={closeMore}
        />

        <ArrangeSheet
          visible={arranging}
          arrangement={arrangement}
          bottomInset={insets.bottom}
          onArrange={onArrange}
          onDone={closeArrange}
        />
      </ScrollView>
      {docked ? (
        <DockedMiniPlayer
          bottomInset={insets.bottom}
          onOpenQueue={queue.open}
        />
      ) : null}
      {queue.sheet}
    </View>
  );
}
