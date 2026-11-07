import { ScrubRow, type ScrubNote } from '@kitbag/core-design';
import { useLoopScrub, useStemPlayer } from '@kitbag/core-state';

import { loopNoteText, songSeconds } from '../logic/sectionView.ts';
import { SectionNotches, SectionTint } from './SectionMarks.tsx';
import type { MixerFrameValues } from './useMixerFrame.ts';

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
  return (
    <ScrubRow
      frame={frame}
      {...scrub}
      note={note}
      behindFill={
        <SectionTint songSec={frame.songSec} durationSec={durationSec} />
      }
      overFill={<SectionNotches durationSec={durationSec} />}
    />
  );
}
