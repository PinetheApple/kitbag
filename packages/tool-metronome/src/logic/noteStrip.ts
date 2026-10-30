const EMPTY_LINE = ' ';

export interface NoteStrip {
  readonly text: string;
  readonly spoken: string | null;
}

// One line whenever a song is loaded, so notes coming and going between songs
// never move the tempo block below.
export function noteStrip(
  songLoaded: boolean,
  notes: string | null,
): NoteStrip | null {
  if (!songLoaded) return null;
  const line = (notes ?? '').replace(/\s+/g, ' ').trim();
  if (line === '') return { text: EMPTY_LINE, spoken: null };
  return { text: line, spoken: `Song notes: ${line}` };
}
