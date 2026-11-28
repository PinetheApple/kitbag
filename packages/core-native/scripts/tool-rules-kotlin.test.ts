import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderToolRulesKotlin } from './tool-rules-kotlin.ts';

const RULES_FILE = join(
  import.meta.dirname,
  '..',
  '..',
  'app-shell',
  'tool-bundle-rules.json',
);
const KOTLIN_STRING =
  /internal const val TOOL_BUNDLE_RULES_JSON = "((?:[^"\\]|\\.)*)"/;

function unescapeKotlin(literal: string): string {
  return literal.replace(/\\(.)/g, (_, char: string) =>
    char === 'n' ? '\n' : char,
  );
}

function embedded(kotlin: string): unknown {
  const literal = KOTLIN_STRING.exec(kotlin)?.[1];
  if (literal === undefined) throw new Error('no TOOL_BUNDLE_RULES_JSON');
  return JSON.parse(unescapeKotlin(literal));
}

describe('renderToolRulesKotlin', () => {
  it('embeds the rules JSON unchanged, so Kotlin parses the same rules', () => {
    const json = readFileSync(RULES_FILE, 'utf8');
    expect(embedded(renderToolRulesKotlin(json))).toEqual(JSON.parse(json));
  });

  it('escapes the characters a Kotlin string would read as a template or an end quote', () => {
    const kotlin = renderToolRulesKotlin('{"a":"^\\\\d$","b":"say \\"hi\\""}');
    expect(kotlin).toContain('\\$');
    expect(embedded(kotlin)).toEqual({ a: '^\\d$', b: 'say "hi"' });
  });

  it('refuses text that is not JSON', () => {
    expect(() => renderToolRulesKotlin('{')).toThrow();
  });
});
