import { ScrubRow, type PlayerFrame } from '@kitbag/core-design';
import { useLoopScrub, useStemPlayer } from '@kitbag/core-state';

export function Scrubber({ frame }: { readonly frame: PlayerFrame }) {
  const scrub = useLoopScrub(useStemPlayer);
  return <ScrubRow frame={frame} {...scrub} />;
}
