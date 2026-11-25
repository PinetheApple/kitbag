import { ADVANCE_CAUSE, type AdvanceCause } from '../stemPlayer/songEnd.ts';
import type { AdvancingPlayer, AutoAdvanceDeps } from './autoAdvance.ts';

function paused({ advanceTo, ...others }: AdvancingPlayer): AdvancingPlayer {
  const view = { ...others, takeOver: others.paused.takeOver };
  const advancePaused = others.paused.advanceTo;
  return advanceTo === undefined || advancePaused === undefined
    ? view
    : { ...view, advanceTo: advancePaused };
}

export function startingPaused(
  deps: AutoAdvanceDeps,
  cause: AdvanceCause,
): AutoAdvanceDeps {
  if (cause !== ADVANCE_CAUSE.nextPaused) return deps;
  const { stems, song } = deps.players;
  return { ...deps, players: { stems: paused(stems), song: paused(song) } };
}
