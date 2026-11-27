import type { SourceCredit } from '@kitbag/core-state';

export function creditLinkText({ url }: Pick<SourceCredit, 'url'>): string {
  return url.replace(/^https?:\/\//, '');
}
