import {
  AppBar,
  AppBarAction,
  Button,
  createThemedStyles,
  homeArrange,
  space,
  ToolGrid,
  ToolRow,
  type ToolGridItem,
} from '@kitbag/core-design';
import {
  summarize,
  useHomeLayout,
  useLastTool,
  useMetronome,
  useSongLibrary,
  useTuner,
  visibleTiles,
} from '@kitbag/core-state';
import { DEFAULT_TUNING, tuningLabel } from '@kitbag/tool-tuner';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsRoutes } from '../settings/settingsRoutes.ts';
import { ArrangeSheet } from './ArrangeSheet.tsx';
import {
  homeArrangement,
  toolFor,
  type HomeArrangement,
} from './arrangement.ts';
import {
  continueTarget,
  HOME_TOOLS,
  TOOL_ID,
  type HomeToolEntry,
} from './registry.ts';
import {
  metronomeResumeSubtitle,
  metronomeTileSubtext,
  songsTileSubtext,
  stemsTileSubtext,
  LIBRARY_UNAVAILABLE_SUBTEXT,
  UPCOMING_SUBTEXT,
  type MetronomeSummary,
} from './subtext.ts';

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  content: {
    paddingHorizontal: space.screenInset,
    gap: space.sectionGap,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeArrange.appBarGap,
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
// show as upcoming rather than with a made-up number (SPEC §2).
function useLiveText(): Readonly<Record<string, LiveText>> {
  const metronome = useMetronomeSummary();
  // The tuning the next visit opens on: the session's, else the default.
  const tuning = tuningLabel(useTuner((s) => s.tuning) ?? DEFAULT_TUNING);
  const libraryRows = useSongLibrary((s) => s.rows);
  const libraryFailed = useSongLibrary((s) => s.failed);
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
    };
  }, [metronome, tuning, libraryRows, libraryFailed]);
}

function useArrangement() {
  const saved = useHomeLayout((s) => s.arrangement);
  const arrange = useHomeLayout((s) => s.arrange);
  const arrangement = useMemo(() => homeArrangement(saved), [saved]);
  const onArrange = useCallback(
    (next: HomeArrangement) => {
      if (next !== arrangement) arrange(next);
    },
    [arrangement, arrange],
  );
  return { arrangement, onArrange };
}

export function HomeScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const liveText = useLiveText();
  const lastToolId = useLastTool((s) => s.toolId);
  const { openSettings } = useSettingsRoutes();
  const { arrangement, onArrange } = useArrangement();
  const [arranging, setArranging] = useState(false);
  const openArrange = useCallback(() => {
    setArranging(true);
  }, []);
  const closeArrange = useCallback(() => {
    setArranging(false);
  }, []);

  const contentInsets = useMemo(
    () => ({
      paddingTop: space.screenInset + insets.top,
      paddingBottom: space.screenInset + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );

  const open = (tool: HomeToolEntry) => {
    if (tool.homeTile === undefined) return undefined;
    // The registry's route is a plain string (§9.1); typed routes cannot see
    // that it names a file under app/.
    const href = tool.homeTile.route as Href;
    return () => {
      router.push(href);
    };
  };

  const resume = continueTarget(lastToolId, HOME_TOOLS);
  const resumeText = resume === undefined ? undefined : liveText[resume.id];

  const tiles: ToolGridItem[] = visibleTiles(arrangement).flatMap((tile) => {
    const tool = toolFor(tile);
    if (tool === undefined) return [];
    return [
      {
        id: tool.id,
        size: tile.size,
        icon: tool.icon,
        title: tool.name,
        subtext: liveText[tool.id]?.tile ?? UPCOMING_SUBTEXT,
        status: tool.homeTile === undefined ? 'upcoming' : 'ready',
        onPress: open(tool),
        onLongPress: openArrange,
      },
    ];
  });
  const rows = HOME_TOOLS.filter((tool) => tool.layout === 'row');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, contentInsets]}
    >
      <AppBar
        wordmark
        title="Kitbag"
        trailing={
          <View style={styles.actions}>
            <Button
              variant="tonal"
              size="small"
              icon="edit"
              iconSize="field"
              label="Edit"
              accessibilityLabel="Edit Home layout"
              onPress={openArrange}
            />
            <AppBarAction
              icon="settings"
              accessibilityLabel="Settings"
              onPress={openSettings}
            />
          </View>
        }
      />

      {resume === undefined || resumeText === undefined ? null : (
        <ToolRow
          variant="resume"
          icon={resume.icon}
          title={`Continue · ${resume.name}`}
          subtitle={resumeText.resume}
          status="ready"
          onPress={open(resume)}
        />
      )}

      <ToolGrid tiles={tiles} />

      {rows.map((tool) => (
        <ToolRow
          key={tool.id}
          icon={tool.icon}
          title={tool.name}
          subtitle={liveText[tool.id]?.tile ?? UPCOMING_SUBTEXT}
          status={tool.homeTile === undefined ? 'upcoming' : 'ready'}
          onPress={open(tool)}
        />
      ))}

      {/* The Tools manager (§9.3) is not built, so this has nowhere to go. */}
      <ToolRow
        icon="moreTools"
        title="More tools"
        subtitle="Future tools arrive as plugins"
        status="upcoming"
      />

      <ArrangeSheet
        visible={arranging}
        arrangement={arrangement}
        bottomInset={insets.bottom}
        onArrange={onArrange}
        onDone={closeArrange}
      />
    </ScrollView>
  );
}
