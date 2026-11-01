const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const TIME_TAG = /^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const OFFSET_TAG = /^\[offset:\s*([+-]?\d+)\s*\]$/i;
const WORD_STAMP = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;
const LINE_BREAK = /\r?\n/;
const SPACES = /\s+/g;

export interface LyricLine {
  readonly timeSec: number;
  readonly text: string;
}

function stampSeconds(
  minutes: string,
  seconds: string,
  fraction: string | undefined,
): number {
  return (
    Number(minutes) * SECONDS_PER_MINUTE +
    Number(fraction === undefined ? seconds : `${seconds}.${fraction}`)
  );
}

function timedLine(raw: string): LyricLine[] {
  const stamps: number[] = [];
  let rest = raw;
  for (let tag = TIME_TAG.exec(rest); tag; tag = TIME_TAG.exec(rest)) {
    const [whole, minutes = '', seconds = '', fraction] = tag;
    stamps.push(stampSeconds(minutes, seconds, fraction));
    rest = rest.slice(whole.length);
  }
  const text = rest.replace(WORD_STAMP, '').replace(SPACES, ' ').trim();
  return stamps.map((timeSec) => ({ timeSec, text }));
}

// A positive [offset:ms] shows lines sooner; StemDeck reads it the same way and
// applies the bundle's offset_sec on top.
export function parseLrc(text: string): LyricLine[] {
  let offsetSec = 0;
  const lines: LyricLine[] = [];
  for (const raw of text.split(LINE_BREAK)) {
    const offset = OFFSET_TAG.exec(raw.trim());
    if (offset) offsetSec = Number(offset[1]) / MS_PER_SECOND;
    else lines.push(...timedLine(raw));
  }
  return lines
    .map((line) => ({
      ...line,
      timeSec: Math.max(0, line.timeSec - offsetSec),
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
}
