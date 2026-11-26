import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import type { PlayAlongTrack, TapOutcome } from './store.ts';

export interface LibraryOffer {
  readonly sessionId: string;
  readonly track: PlayAlongTrack;
  readonly match: LibraryMatch;
}

export interface LibraryOfferState {
  readonly offer: LibraryOffer | undefined;
}

export interface LibraryOfferActions {
  readonly watchLibrary: () => () => void;
  readonly acceptOffer: () => Promise<TapOutcome>;
  readonly dismissOffer: () => void;
}
