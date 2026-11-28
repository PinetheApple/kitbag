const KOTLIN_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '"': '\\"',
  $: '\\$',
};

export function renderToolRulesKotlin(rulesJson: string): string {
  const compact = JSON.stringify(JSON.parse(rulesJson));
  const literal = compact.replace(
    /[\\"$]/g,
    (char) => KOTLIN_ESCAPES[char] ?? char,
  );
  return `// GENERATED from packages/app-shell/tool-bundle-rules.json — DO NOT EDIT.
// Regenerate: pnpm --filter @kitbag/core-native generate
package com.kitbag.corenative.tools

internal const val TOOL_BUNDLE_RULES_JSON = "${literal}"
`;
}
