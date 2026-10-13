import {
  AppBar,
  createThemedStyles,
  space,
  ToolGrid,
  ToolRow,
  type ToolGridItem,
} from '@kitbag/core-design';
import { useLastTool, useMetronome } from '@kitbag/core-state';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  continueTarget,
  HOME_TOOLS,
  TOOL_ID,
  type HomeToolEntry,
} from './registry.ts';
import {
  metronomeResumeSubtitle,
  metronomeTileSubtext,
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
  return useMemo(
    () => ({
      [TOOL_ID.metronome]: {
        tile: metronomeTileSubtext(metronome),
        resume: metronomeResumeSubtitle(metronome),
      },
    }),
    [metronome],
  );
}

export function HomeScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const liveText = useLiveText();
  const lastToolId = useLastTool((s) => s.toolId);

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

  const tiles: ToolGridItem[] = HOME_TOOLS.flatMap((tool) =>
    tool.layout === 'row'
      ? []
      : [
          {
            id: tool.id,
            size: tool.layout,
            icon: tool.icon,
            title: tool.name,
            subtext: liveText[tool.id]?.tile ?? UPCOMING_SUBTEXT,
            status: tool.homeTile === undefined ? 'upcoming' : 'ready',
            onPress: open(tool),
          },
        ],
  );
  const rows = HOME_TOOLS.filter((tool) => tool.layout === 'row');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, contentInsets]}
    >
      <AppBar wordmark title="Kitbag" />

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
    </ScrollView>
  );
}
