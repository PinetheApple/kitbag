import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';

import { speedText } from '../text.ts';
import { UNSHIFTED_KEY } from './mix.ts';

export const MIXDOWN_EXTENSION = '.wav';

const FALLBACK_TITLE = 'Mix';
const ARTIST_SEPARATOR = ' - ';
const UNSAFE_CHARS = /[/\\:*?"<>|\p{Cc}]/gu;
const WHITESPACE_RUN = /\s+/gu;
const LEADING_DOTS_AND_SPACES = /^[.\s]+/u;

const ONE_BYTE_LIMIT = 0x80;
const TWO_BYTE_LIMIT = 0x800;
const THREE_BYTE_LIMIT = 0x10000;
const ONE_BYTE = 1;
const TWO_BYTES = 2;
const THREE_BYTES = 3;
const FOUR_BYTES = 4;

export interface MixdownNameParts {
  readonly title: string;
  readonly artist: string | null;
  readonly speed: number;
  readonly key: number | null;
}

function codePointBytes(char: string): number {
  const point = char.codePointAt(0) ?? 0;
  if (point < ONE_BYTE_LIMIT) return ONE_BYTE;
  if (point < TWO_BYTE_LIMIT) return TWO_BYTES;
  if (point < THREE_BYTE_LIMIT) return THREE_BYTES;
  return FOUR_BYTES;
}

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) bytes += codePointBytes(char);
  return bytes;
}

function clipToBytes(text: string, budget: number): string {
  let used = 0;
  let clipped = '';
  for (const char of text) {
    used += codePointBytes(char);
    if (used > budget) break;
    clipped += char;
  }
  return clipped;
}

function cleaned(text: string): string {
  return text.replace(UNSAFE_CHARS, '').replace(WHITESPACE_RUN, ' ').trim();
}

function speedPart(speed: number): string | null {
  if (speed === KB_MIXER_UNITY_RATE) return null;
  return `${speedText(speed)}x`;
}

function keyPart(key: number | null): string | null {
  if (key === null || key === UNSHIFTED_KEY) return null;
  return `${key > 0 ? '+' : ''}${String(key)} st`;
}

function suffixOf({ speed, key }: MixdownNameParts): string {
  const parts = [speedPart(speed), keyPart(key)].filter((p) => p !== null);
  return parts.length === 0 ? '' : ` (${parts.join(', ')})`;
}

export function mixdownFileName(
  parts: MixdownNameParts,
  maxBaseNameBytes: number,
): string {
  const title = cleaned(parts.title).replace(LEADING_DOTS_AND_SPACES, '');
  const artist = parts.artist === null ? '' : cleaned(parts.artist);
  const song = title === '' ? FALLBACK_TITLE : title;
  const named = artist === '' ? song : `${song}${ARTIST_SEPARATOR}${artist}`;
  const suffix = suffixOf(parts);
  const head = clipToBytes(named, maxBaseNameBytes - utf8Bytes(suffix));
  return `${head.trimEnd()}${suffix}${MIXDOWN_EXTENSION}`;
}
