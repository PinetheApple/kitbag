import { SAVE_FAILED, SHARE_FAILED } from './backupText.ts';

export type BackUpAction = 'save' | 'share';

type Failure = `${BackUpAction}Failed`;

export type BackUpSheetEvent =
  'open' | 'dismiss' | 'start' | 'done' | 'cancelled' | Failure;

export interface BackUpSheetState {
  readonly open: boolean;
  readonly busy: boolean;
  readonly failed: BackUpAction | null;
}

export const CLOSED_BACK_UP_SHEET: BackUpSheetState = {
  open: false,
  busy: false,
  failed: null,
};

const FAILURE_TEXT: Readonly<Record<BackUpAction, string>> = {
  save: SAVE_FAILED,
  share: SHARE_FAILED,
};

export function nextBackUpSheet(
  state: BackUpSheetState,
  event: BackUpSheetEvent,
): BackUpSheetState {
  switch (event) {
    case 'open':
      return { open: true, busy: false, failed: null };
    case 'dismiss':
      return { ...state, open: false };
    case 'start':
      return { ...state, busy: true };
    case 'done':
      return CLOSED_BACK_UP_SHEET;
    case 'cancelled':
      return { ...state, busy: false };
    case 'saveFailed':
      return { open: false, busy: false, failed: 'save' };
    case 'shareFailed':
      return { open: false, busy: false, failed: 'share' };
  }
}

export function backUpRowValue(
  state: BackUpSheetState,
  summary: string | null,
): string | null {
  return state.failed === null ? summary : FAILURE_TEXT[state.failed];
}

export async function backUpEvent(
  action: BackUpAction,
  run: () => Promise<boolean>,
): Promise<BackUpSheetEvent> {
  try {
    return (await run()) ? 'done' : 'cancelled';
  } catch (error: unknown) {
    console.warn(`[kitbag] could not ${action} the backup`, error);
    return `${action}Failed`;
  }
}
