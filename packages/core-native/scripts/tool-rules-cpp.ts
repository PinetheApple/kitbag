interface CppRules {
  readonly hbc: { readonly magic: string; readonly versionBytes: number };
  readonly limits: { readonly inflatedMaxBytes: number };
}

const HEX_BYTES = /^(?:[0-9a-f]{2})+$/;
const HEX_BYTE = /[0-9a-f]{2}/g;

function wholeNumber(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

function magicBytes(hex: string): string {
  if (!HEX_BYTES.test(hex))
    throw new Error('hbc.magic must be lowercase hex bytes');
  return (hex.match(HEX_BYTE) ?? []).map((byte) => `0x${byte}`).join(', ');
}

export function renderToolRulesCpp(rulesJson: string): string {
  const rules = JSON.parse(rulesJson) as CppRules;
  const magic = magicBytes(rules.hbc.magic);
  const magicLength = rules.hbc.magic.length / 2;
  const versionBytes = wholeNumber(rules.hbc.versionBytes, 'hbc.versionBytes');
  const inflated = wholeNumber(
    rules.limits.inflatedMaxBytes,
    'limits.inflatedMaxBytes',
  );
  return `// GENERATED from packages/app-shell/tool-bundle-rules.json — DO NOT EDIT.
// Regenerate: pnpm --filter @kitbag/core-native generate
#ifndef KITBAG_TOOL_BUNDLE_RULES_GEN_H
#define KITBAG_TOOL_BUNDLE_RULES_GEN_H

#include <array>
#include <cstddef>
#include <cstdint>

namespace kitbag {

inline constexpr std::array<uint8_t, ${String(magicLength)}> kHbcMagic = {${magic}};
inline constexpr std::size_t kHbcVersionBytes = ${String(versionBytes)};
inline constexpr std::size_t kInflatedMaxBytes = ${String(inflated)};

}  // namespace kitbag

#endif  // KITBAG_TOOL_BUNDLE_RULES_GEN_H
`;
}
