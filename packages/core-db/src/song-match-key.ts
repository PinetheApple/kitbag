export interface SongIdentity {
  readonly title: string;
  readonly artist: string;
}

const COMBINING_MARKS = /\p{M}/gu;
const UNDECOMPOSED_LETTERS = /[øæßłđœ]/g;
const LETTER_FOLDS: Readonly<Record<string, string>> = {
  ø: 'o',
  æ: 'ae',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
  œ: 'oe',
};
const BRACKETED = /[([{]([^)\]}]*)[)\]}]/g;
const DASHED_NOTE = /\s[-–—]\s(.*)$/;
const FEATURING = /\b(?:feat|ft|featuring)\b(?:[.\s].*)?$/;
const AMPERSAND = /&/g;
const APOSTROPHES = /['’]/g;
const NON_WORD = /[^\p{L}\p{N}]+/gu;
const CREDIT_SEPARATOR = /[,;/&]/;
const LEADING_THE = /^the /;
const YEAR = /^\d{4}$/;
const TEMPO_NEUTRAL_WORDS = new Set([
  'remaster',
  'remastered',
  'mono',
  'stereo',
  'single',
  'radio',
  'edit',
]);
const NOTE_FILLER_WORDS = new Set(['digital', 'digitally', 'version']);
const WORD_SPELLINGS: Readonly<Record<string, string>> = {
  pt: 'part',
  ii: '2',
  iii: '3',
  iv: '4',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
};

function folded(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(UNDECOMPOSED_LETTERS, (letter) => LETTER_FOLDS[letter] ?? letter);
}

function plainWords(text: string): string[] {
  return text
    .replace(AMPERSAND, ' and ')
    .replace(APOSTROPHES, '')
    .replace(NON_WORD, ' ')
    .trim()
    .split(' ')
    .filter((word) => word !== '');
}

function isTempoNeutral(note: string): boolean {
  if (FEATURING.test(note.trim())) return true;
  const words = plainWords(note);
  return (
    words.some((word) => TEMPO_NEUTRAL_WORDS.has(word)) &&
    words.every(
      (word) =>
        TEMPO_NEUTRAL_WORDS.has(word) ||
        NOTE_FILLER_WORDS.has(word) ||
        YEAR.test(word),
    )
  );
}

function withoutNeutralNotes(text: string): string {
  return text
    .replace(BRACKETED, (_whole, note: string) =>
      isTempoNeutral(note) ? ' ' : ` ${note} `,
    )
    .replace(DASHED_NOTE, (_whole, note: string) =>
      isTempoNeutral(note) ? '' : ` ${note}`,
    )
    .replace(FEATURING, '');
}

export function songMatchText(text: string): string {
  return plainWords(withoutNeutralNotes(folded(text)))
    .map((word) => WORD_SPELLINGS[word] ?? word)
    .join(' ');
}

export function artistMatchText(artist: string): string {
  return songMatchText(artist).replace(LEADING_THE, '');
}

export function artistCredits(artist: string): string[] {
  return folded(artist)
    .replace(FEATURING, '')
    .split(CREDIT_SEPARATOR)
    .map(artistMatchText)
    .filter((credit) => credit !== '');
}

export function songMatchKey(song: SongIdentity): SongIdentity {
  return {
    title: songMatchText(song.title),
    artist: artistMatchText(song.artist),
  };
}
