export const VIEW_ONLY_REASON = 'Play this song to change it';

export function viewPlayLabel(title: string, playing: string): string {
  return `Play ${title}. Stops ${playing}.`;
}
