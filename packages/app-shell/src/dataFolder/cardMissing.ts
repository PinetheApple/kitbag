export type InternalOffer = 'offer' | 'importing' | 'none';

export interface OfferInput {
  readonly rootMissing: boolean;
  readonly moveActive: boolean;
  readonly importing: boolean;
}

export const PUT_BACK = 'I’ve put it back';
export const USE_INTERNAL = 'Use internal storage';
export const CLOSE_CARD_MISSING = 'Close SD card not found';

const CHOICE_HINT =
  'Or use internal storage for new songs from now on. The songs on the card stay listed until it’s back.';

// Switching takes the import lock for writing, so it never runs under an import.
export function internalOffer({
  rootMissing,
  moveActive,
  importing,
}: OfferInput): InternalOffer {
  if (!rootMissing || moveActive) return 'none';
  return importing ? 'importing' : 'offer';
}

export function cardMissingHints(
  cardName: string,
  offered: boolean,
): readonly string[] {
  const reinsert = `Your song audio, stems and waveforms are on ${cardName}. Put the card back and they play again as they were. Nothing has been deleted.`;
  return offered ? [reinsert, CHOICE_HINT] : [reinsert];
}
