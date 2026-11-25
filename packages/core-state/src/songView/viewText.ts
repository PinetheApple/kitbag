export const VIEW_ONLY_REASON = 'Play this song to change it';

export function viewPlayLabel(title: string, playing: string | null): string {
  return playing === null
    ? `Play ${title}`
    : `Play ${title}. Stops ${playing}.`;
}
