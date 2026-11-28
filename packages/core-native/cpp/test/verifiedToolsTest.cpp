#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "KitbagToolEval.h"
#include "VerifiedTools.h"

namespace {

using kitbag::BundleCheck;
using kitbag::HandOffResult;
using kitbag::VerifiedBundle;
using kitbag::VerifiedToolStore;

int failures = 0;

constexpr uint32_t kRuntime = 96;
constexpr uint32_t kMultiByteVersion = 259;

void check(bool ok, const char* what) {
  if (ok) return;
  std::fprintf(stderr, "FAIL: %s\n", what);
  ++failures;
}

std::vector<uint8_t> hbc(uint32_t version, std::size_t body_bytes = 4) {
  std::vector<uint8_t> bytes(
      kitbag::kHbcMagic.begin(),
      kitbag::kHbcMagic.end()
  );
  for (std::size_t i = 0; i < kitbag::kHbcVersionBytes; ++i) {
    bytes.push_back(static_cast<uint8_t>(version >> (i * 8)));
  }
  bytes.resize(bytes.size() + body_bytes, 0x5a);
  return bytes;
}

VerifiedBundle bundle(uint32_t manifest_version, uint32_t header_version) {
  return {hbc(header_version), manifest_version};
}

bool same(const char* a, const char* b) {
  return a != nullptr && b != nullptr && std::strcmp(a, b) == 0;
}

void expectHeaderVersions() {
  check(
      kitbag::HbcVersion(hbc(kRuntime)) == kRuntime,
      "reads the version after the magic"
  );
  check(
      kitbag::HbcVersion(hbc(kMultiByteVersion)) == kMultiByteVersion,
      "reads every version byte, little-endian"
  );
  check(
      kitbag::HbcVersion(hbc(kRuntime, 0)) == kRuntime,
      "a bare header is long enough"
  );
  auto short_header = hbc(kRuntime, 0);
  short_header.pop_back();
  check(
      !kitbag::HbcVersion(short_header),
      "one byte short of a header is refused"
  );
  auto last_magic_byte = hbc(kRuntime);
  last_magic_byte[kitbag::kHbcMagic.size() - 1] ^= 1;
  check(!kitbag::HbcVersion(last_magic_byte), "every magic byte is compared");
  std::vector<uint8_t> reversed(
      kitbag::kHbcMagic.rbegin(),
      kitbag::kHbcMagic.rend()
  );
  reversed.resize(hbc(kRuntime).size());
  check(
      !kitbag::HbcVersion(reversed),
      "the magic is matched in file byte order"
  );
  const std::string source = "'use strict';globalThis.x=1;";
  check(
      !kitbag::HbcVersion(
          {reinterpret_cast<const uint8_t*>(source.data()), source.size()}
      ),
      "JS source is not bytecode"
  );
}

void expectBundleChecks() {
  check(
      kitbag::CheckVerifiedBundle(bundle(kRuntime, kRuntime), kRuntime) ==
          BundleCheck::kOk,
      "matching versions pass"
  );
  check(
      kitbag::CheckVerifiedBundle(bundle(kRuntime, kRuntime + 1), kRuntime) ==
          BundleCheck::kBytecodeVersionMismatch,
      "a header newer than the runtime is refused"
  );
  check(
      kitbag::CheckVerifiedBundle(bundle(kRuntime, kRuntime - 1), kRuntime) ==
          BundleCheck::kBytecodeVersionMismatch,
      "a header older than the runtime is refused even when the manifest "
      "matches"
  );
  check(
      kitbag::CheckVerifiedBundle(bundle(kRuntime + 1, kRuntime), kRuntime) ==
          BundleCheck::kManifestVersionMismatch,
      "a manifest pinning another runtime is refused even when the header "
      "matches"
  );
  VerifiedBundle not_hbc{
      {'v', 'a', 'r', ' ', 'x', '=', '1', ';', ' ', ' ', ' ', ' '},
      kRuntime
  };
  check(
      kitbag::CheckVerifiedBundle(not_hbc, kRuntime) ==
          BundleCheck::kNotHermesBytecode,
      "source text is refused"
  );
}

void expectRefusal(
    VerifiedBundle handed,
    std::optional<uint32_t> runtime,
    const char* code,
    const char* detail,
    const char* what
) {
  VerifiedToolStore store;
  store.HandOff("tuner", std::move(handed));
  const auto plan = kitbag::PlanToolEval(store, "tuner", runtime);
  check(same(plan.refusal, code), what);
  check(plan.detail == detail, "the refusal names the versions it compared");
  check(plan.bundle.bytecode.empty(), "a refusal carries no bytes to evaluate");
  check(store.pending_count() == 0, "a refused bundle is used up");
}

void expectPlans() {
  VerifiedToolStore empty;
  check(
      same(
          kitbag::PlanToolEval(empty, "tuner", kRuntime).refusal,
          kitbag::kToolErrorNotVerified
      ),
      "nothing handed off is refused as not verified"
  );
  expectRefusal(
      bundle(kRuntime, kRuntime),
      std::nullopt,
      kitbag::kToolErrorRuntimeVersion,
      "runtime reports no version",
      "an unknown runtime version is refused"
  );
  expectRefusal(
      {{'v', 'a', 'r', ' ', 'x', '=', '1', ';', ' ', ' ', ' ', ' '}, kRuntime},
      kRuntime,
      kitbag::kToolErrorNotBytecode,
      "no hbc header",
      "source text is refused, not run"
  );
  expectRefusal(
      bundle(kRuntime + 1, kRuntime),
      kRuntime,
      kitbag::kToolErrorManifestVersion,
      "manifest pins bytecode 97, runtime 96",
      "a manifest mismatch is refused"
  );
  expectRefusal(
      bundle(kRuntime, kMultiByteVersion),
      kRuntime,
      kitbag::kToolErrorBytecodeVersion,
      "bundle is bytecode 259, runtime 96",
      "a header mismatch is refused"
  );
  VerifiedToolStore store;
  store.HandOff("tuner", bundle(kRuntime, kRuntime));
  const auto plan = kitbag::PlanToolEval(store, "tuner", kRuntime);
  check(
      plan.refusal == nullptr && plan.bundle.bytecode == hbc(kRuntime),
      "a matching bundle is planned for evaluation with its bytes"
  );
  check(store.pending_count() == 0, "an evaluated bundle is used up");
}

void expectTakeClears() {
  VerifiedToolStore store;
  check(
      store.HandOff("metronome", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStored,
      "a handoff is stored"
  );
  check(!store.Take("metro"), "a prefix of an id finds nothing");
  const auto taken = store.Take("metronome");
  check(
      taken && taken->bytecode == hbc(kRuntime) &&
          taken->bytecode_version == kRuntime,
      "take returns the bytes and version"
  );
  check(!store.Take("metronome"), "a taken bundle is gone");
  check(store.pending_count() == 0, "nothing stays pending after take");
}

void expectDrop() {
  VerifiedToolStore store;
  store.HandOff("tuner", bundle(kRuntime, kRuntime));
  store.HandOff("stems", bundle(kRuntime, kRuntime));
  check(store.Drop("tuner"), "drop reports a pending bundle it removed");
  check(!store.Take("tuner"), "a dropped bundle cannot be evaluated");
  check(store.Take("stems").has_value(), "drop leaves other tools pending");
  check(!store.Drop("tuner"), "drop reports nothing to remove");
}

void expectReplacement() {
  VerifiedToolStore store;
  store.HandOff("tuner", bundle(kRuntime, kRuntime));
  store.HandOff("tuner", bundle(kRuntime + 1, kMultiByteVersion));
  check(store.pending_count() == 1, "a second handoff replaces, not adds");
  const auto taken = store.Take("tuner");
  check(
      taken && taken->bytecode == hbc(kMultiByteVersion) &&
          taken->bytecode_version == kRuntime + 1,
      "the newest handoff wins"
  );
}

void expectBounds() {
  VerifiedToolStore store;
  for (std::size_t i = 0; i < kitbag::kMaxPendingTools; ++i) {
    check(
        store.HandOff(
            "tool-" + std::to_string(i),
            bundle(kRuntime, kRuntime)
        ) == HandOffResult::kStored,
        "fills to the cap"
    );
  }
  check(
      store.HandOff("tool-extra", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStoreFull,
      "one past the cap is refused"
  );
  check(
      store.pending_count() == kitbag::kMaxPendingTools,
      "a refused handoff stores nothing"
  );
  check(
      store.HandOff("tool-0", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStored,
      "a full store still replaces"
  );
  store.Take("tool-1");
  check(
      store.HandOff("tool-extra", bundle(kRuntime, kRuntime)) ==
          HandOffResult::kStored,
      "take frees a slot"
  );
}

void expectSizeCap() {
  check(
      kitbag::kMaxToolBytecodeBytes == kitbag::kInflatedMaxBytes,
      "the cap is the rules' inflated limit"
  );
  check(
      kitbag::ToolBytecodeFits(kitbag::kInflatedMaxBytes),
      "the rules' inflated cap itself fits"
  );
  check(
      !kitbag::ToolBytecodeFits(kitbag::kInflatedMaxBytes + 1),
      "one byte over the rules' cap does not fit"
  );
  VerifiedToolStore store;
  VerifiedBundle big{
      std::vector<uint8_t>(kitbag::kInflatedMaxBytes + 1),
      kRuntime
  };
  check(
      store.HandOff("big", std::move(big)) == HandOffResult::kTooLarge,
      "an oversized handoff is refused"
  );
  check(
      store.pending_count() == 0 && !store.Take("big"),
      "an oversized handoff stores nothing"
  );
}

}  // namespace

int main() {
  expectHeaderVersions();
  expectBundleChecks();
  expectPlans();
  expectTakeClears();
  expectDrop();
  expectReplacement();
  expectBounds();
  expectSizeCap();
  if (failures == 0) std::puts("verified tools: all checks passed");
  return failures == 0 ? 0 : 1;
}
