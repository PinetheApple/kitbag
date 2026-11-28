import type { SourceCredit } from './tempoLadder/sources.ts';

export function creditLinkText({ url }: Pick<SourceCredit, 'url'>): string {
  return url.replace(/^https?:\/\//, '');
}
