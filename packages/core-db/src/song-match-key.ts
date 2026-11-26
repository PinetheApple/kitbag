export interface SongIdentity {
  readonly title: string;
  readonly artist: string;
}

const COMBINING_MARKS = /\p{M}/gu;
const BRACKETED = /[([{][^)\]}]*[)\]}]/g;
const FEATURING = /\b(?:feat|ft|featuring)\b[.\s].*$/;
const RELEASE_NOTE =
  /\s[-–—]\s.*\b(?:remaster(?:ed)?|live|version|edit|mix|mono|stereo|demo|acoustic|radio|single)\b.*$/;
const AMPERSAND = /&/g;
const APOSTROPHES = /['’]/g;
const NON_WORD = /[^\p{L}\p{N}]+/gu;
const CREDIT_SEPARATOR = /[,;/&]/;

function folded(text: string): string {
  return text.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase();
}

function withoutBrackets(text: string): string {
  const stripped = text.replace(BRACKETED, ' ');
  return stripped.trim() === '' ? text : stripped;
}

function plainWords(text: string): string {
  return text
    .replace(AMPERSAND, ' and ')
    .replace(APOSTROPHES, '')
    .replace(NON_WORD, ' ')
    .trim();
}

export function songMatchText(text: string): string {
  return plainWords(
    withoutBrackets(folded(text))
      .replace(FEATURING, '')
      .replace(RELEASE_NOTE, ''),
  );
}

export function artistCredits(artist: string): string[] {
  return folded(artist)
    .replace(FEATURING, '')
    .split(CREDIT_SEPARATOR)
    .map(songMatchText)
    .filter((credit) => credit !== '');
}

export function songMatchKey(song: SongIdentity): SongIdentity {
  return {
    title: songMatchText(song.title),
    artist: songMatchText(song.artist),
  };
}
