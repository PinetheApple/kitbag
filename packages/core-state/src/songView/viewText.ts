export const VIEW_ONLY_REASON = 'Play this song to change it';

export function viewOnlyReason(
  own: string | null,
  viewing: boolean,
): string | null {
  return own ?? (viewing ? VIEW_ONLY_REASON : null);
}

export function viewPlayLabel(title: string, playing: string): string {
  return `Play ${title}. Stops ${playing}.`;
}
