import {
  ScrubRow,
  type ScrubLaneLayout,
  type ScrubMarks,
  type ScrubNote,
} from '@kitbag/core-design';
import { useLoopScrub, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import {
  aboveFlagsPadding,
  loopNotePlacement,
} from '../logic/loopNotePlacement.ts';
import { loopNoteText, songSeconds } from '../logic/sectionView.ts';
import { SectionNotches, SectionTint } from './SectionMarks.tsx';
import type { MixerFrameValues } from './useMixerFrame.ts';

function useLaneLayout(marks: ScrubMarks | null): ScrubLaneLayout {
  const [laneWidth, setLaneWidth] = useState(0);
  const [bar, setBar] = useState({ x: 0, width: 0 });
  const [note, setNote] = useState({ width: 0, height: 0 });
  const onLane = useCallback((event: LayoutChangeEvent) => {
    setLaneWidth(event.nativeEvent.layout.width);
  }, []);
  const onBar = useCallback((event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setBar({ x, width });
  }, []);
  const onNote = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setNote({ width, height });
  }, []);
  const placement = loopNotePlacement({
    laneWidth,
    barLeft: bar.x,
    barWidth: bar.width,
    noteWidth: note.width,
    start: marks?.start ?? null,
    end: marks?.end ?? null,
  });
  return {
    noteSide: placement === 'left' ? 'left' : 'right',
    paddingTop: placement === 'above' ? aboveFlagsPadding(note.height) : null,
    onLane,
    onBar,
    onNote,
  };
}

function useSectionNote(
  note: ScrubNote | null,
  durationSec: number,
): ScrubNote | null {
  const loop = useStemPlayer((s) => s.loop);
  const sections = useStemPlayer((s) => s.sections);
  const text = loopNoteText(loop, sections, durationSec);
  return note === null || note.failed || text === null
    ? note
    : { text, failed: false };
}

export function Scrubber({ frame }: { readonly frame: MixerFrameValues }) {
  const scrub = useLoopScrub(useStemPlayer);
  const durationSec = useStemPlayer(songSeconds);
  const note = useSectionNote(scrub.note, durationSec);
  const layout = useLaneLayout(scrub.marks);
  return (
    <ScrubRow
      frame={frame}
      {...scrub}
      note={note}
      layout={layout}
      behindFill={
        <SectionTint songSec={frame.songSec} durationSec={durationSec} />
      }
      overFill={<SectionNotches durationSec={durationSec} />}
    />
  );
}
