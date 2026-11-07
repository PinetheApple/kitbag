const UNTITLED = 'Song';

export function songTitle(title: string): string {
  return title === '' ? UNTITLED : title;
}
