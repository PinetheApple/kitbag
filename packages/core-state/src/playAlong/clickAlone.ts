export interface ClickAloneState {
  readonly clickPlaying: boolean;
}

export interface ClickAloneActions {
  readonly startClick: () => void;
  readonly stopClick: () => void;
}
