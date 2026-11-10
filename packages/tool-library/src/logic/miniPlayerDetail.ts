export function miniPlayerDetail(
  artist: string | null,
  click: boolean,
): string {
  const clickState = click ? 'Click on' : 'Click off';
  return artist === null ? clickState : `${artist} · ${clickState}`;
}
