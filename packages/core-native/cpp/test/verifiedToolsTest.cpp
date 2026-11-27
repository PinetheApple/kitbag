#include <array>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "VerifiedTools.h"

namespace {

using kitbag::BundleCheck;
using kitbag::HandOffResult;
using kitbag::VerifiedBundle;
using kitbag::VerifiedToolStore;

int failures = 0;

constexpr std::array<uint8_t, 8> kMagic =
    {0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f};
constexpr uint32_t kRuntime = 96;
constexpr uint32_t kMultiByteVersion = 259;

void check(bool ok, const char* what) {
  if (ok) return;
  std::fprintf(stderr, "FAIL: %s\n", what);
  ++failures;
}

std::vector<uint8_t> hbc(uint32_t version, std::size_t bodyBytes = 4) {
  std::vector<uint8_t> bytes(kMagic.begin(), kMagic.end());
  for (int shift = 0; shift < 32; shift += 8)
    bytes.push_back(static_cast<uint8_t>(version >> shift));
  bytes.resize(bytes.size() + bodyBytes, 0x5a);
  return bytes;
}

VerifiedBundle bundle(uint32_t manifestVersion, uint32_t headerVersion) {
  return {hbc(headerVersion), manifestVersion};
}

void expectHeaderVersions() {
  check(
      kitbag::hbcVersion(hbc(kRuntime)) == kRuntime,
      "reads the version after the magic"
  );
  check(
      kitbag::hbcVersion(hbc(kMultiByteVersion)) == kMultiByteVersion,
      "reads all four version bytes, little-endian"
  );
  check(
      kitbag::hbcVersion(hbc(kRuntime, 0)) == kRuntime,
      "a bare 12-byte header is long enough"
  );
  auto shortHeader = hbc(kRuntime, 0);
  shortHeader.pop_back();
  check(
      !kitbag::hbcVersion(shortHeader),
      "11 bytes are too short for a header"
  );
  auto lastMagicByte = hbc(kRuntime);
  lastMagicByte[kMagic.size() - 1] ^= 1;
  check(!kitbag::hbcVersion(lastMagicByte), "every magic byte is compared");
  std::vector<uint8_t> reversed(kMagic.rbegin(), kMagic.rend());
  reversed.resize(hbc(kRuntime).size());
  check(
      !kitbag::hbcVersion(reversed),
      "the magic is matched in file byte order"
  );
  const std::string source = "'use strict';globalThis.x=1;";
  check(
      !kitbag::hbcVersion(
          {reinterpret_cast<const uint8_t*>(source.data()), source.size()}
      ),
      "JS source is not bytecode"
  );
}

void expectBundleChecks() {
  check(
      kitbag::checkVerifiedBundle(bundle(kRuntime, kRuntime), kRuntime) ==
          BundleCheck::kOk,
      "matching versions pass"
  );
  check(
      kitbag::checkVerifiedBundle(bundle(kRuntime, kRuntime + 1), kRuntime) ==
          BundleCheck::kBytecodeVersionMismatch,
      "a header newer than the runtime is refused"
  );
  check(
      kitbag::checkVerifiedBundle(bundle(kRuntime, kRuntime - 1), kRuntime) ==
          BundleCheck::kBytecodeVersionMismatch,
      "a header older than the runtime is refused even when the manifest "
      "matches"
  );
  check(
      kitbag::checkVerifiedBundle(bundle(kRuntime + 1, kRuntime), kRuntime) ==
          BundleCheck::kManifestVersionMismatch,
      "a manifest pinning another runtime is refused even when the header "
      "matches"
  );
  VerifiedBundle notHbc{
      {'v', 'a', 'r', ' ', 'x', '=', '1', ';', ' ', ' ', ' ', ' '},
      kRuntime
  };
  check(
      kitbag::checkVerifiedBundle(notHbc, kRuntime) ==
          BundleCheck::kNotHermesBytecode,
      "source text is refused"
  );
}

void expectTakeClears() {
  VerifiedToolStore store;
  check(
      store.handOff("metronome", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStored,
      "a handoff is stored"
  );
  check(!store.take("metro"), "a prefix of an id finds nothing");
  const auto taken = store.take("metronome");
  check(
      taken && taken->bytecode == hbc(kRuntime) &&
          taken->bytecodeVersion == kRuntime,
      "take returns the bytes and version"
  );
  check(!store.take("metronome"), "a taken bundle is gone");
  check(store.pendingCount() == 0, "nothing stays pending after take");
}

void expectReplacement() {
  VerifiedToolStore store;
  store.handOff("tuner", bundle(kRuntime, kRuntime));
  store.handOff("tuner", bundle(kRuntime + 1, kMultiByteVersion));
  check(store.pendingCount() == 1, "a second handoff replaces, not adds");
  const auto taken = store.take("tuner");
  check(
      taken && taken->bytecode == hbc(kMultiByteVersion) &&
          taken->bytecodeVersion == kRuntime + 1,
      "the newest handoff wins"
  );
}

void expectBounds() {
  VerifiedToolStore store;
  for (std::size_t i = 0; i < kitbag::kMaxPendingTools; ++i) {
    check(
        store.handOff(
            "tool-" + std::to_string(i),
            bundle(kRuntime, kRuntime)
        ) == HandOffResult::kStored,
        "fills to the cap"
    );
  }
  check(
      store.handOff("tool-extra", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStoreFull,
      "one past the cap is refused"
  );
  check(
      store.pendingCount() == kitbag::kMaxPendingTools,
      "a refused handoff stores nothing"
  );
  check(
      store.handOff("tool-0", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStored,
      "a full store still replaces"
  );
  store.take("tool-1");
  check(
      store.handOff("tool-extra", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStored,
      "take frees a slot"
  );
}

void expectSizeCap() {
  check(
      kitbag::toolBytecodeFits(kitbag::kMaxToolBytecodeBytes),
      "the cap itself fits"
  );
  check(
      !kitbag::toolBytecodeFits(kitbag::kMaxToolBytecodeBytes + 1),
      "one byte over does not fit"
  );
  VerifiedToolStore store;
  VerifiedBundle big{
      std::vector<uint8_t>(kitbag::kMaxToolBytecodeBytes + 1),
      kRuntime
  };
  check(
      store.handOff("big", std::move(big)) == HandOffResult::kTooLarge,
      "an oversized handoff is refused"
  );
  check(
      store.pendingCount() == 0 && !store.take("big"),
      "an oversized handoff stores nothing"
  );
}

}  // namespace

int main() {
  expectHeaderVersions();
  expectBundleChecks();
  expectTakeClears();
  expectReplacement();
  expectBounds();
  expectSizeCap();
  if (failures == 0) std::puts("verified tools: all checks passed");
  return failures == 0 ? 0 : 1;
}
