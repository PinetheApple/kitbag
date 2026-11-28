import {
  BPM_SOURCE_CREDIT,
  creditLinkText,
  hasGetSongBpmKey,
} from '@kitbag/core-state';

export const GET_SONG_BPM_KEY_LABEL = 'GetSongBPM key';
export const KEY_SET = 'Set';
export const KEY_NOT_SET = 'Not set';
export const KEY_SHEET_HINT =
  "Play along looks a song's tempo up on GetSongBPM with your own key. Without one it uses your library, then tap tempo.";
export const KEY_PRIVACY_HINT = "Kitbag's backup file leaves it out.";
export const KEY_PLACEHOLDER = 'Paste your key';
export const SAVED_KEY_LABEL = 'Saved key';
export const GET_A_KEY_LABEL = 'Get a key';
export const SAVE_KEY = 'Save';
export const REMOVE_KEY = 'Remove key';

export const KEY_CREDIT = BPM_SOURCE_CREDIT.getsongbpm;
export const KEY_CREDIT_TEXT = creditLinkText(KEY_CREDIT);

export function keyStatus(key: string): string {
  return hasGetSongBpmKey(key) ? KEY_SET : KEY_NOT_SET;
}
