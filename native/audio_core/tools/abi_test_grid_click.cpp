#include "kitbag_api.h"

#include <cstdint>
#include <vector>

#include "abi_test_metronome.h"
#include "check.h"
#include "metronome/metronome.h"

namespace abi_test {
namespace {

using kitbag::Metronome;
using kitbag_test::Check;

constexpr int32_t kThreeTwoTwo[] = {3, 2, 2};
constexpr int32_t kUnknownRate = KB_GRID_RATE_HALF + 1;

bool Refuses(kb_engine* engine, const int32_t* sizes, int32_t count) {
  return kb_metronome_set_grid_grouping(engine, sizes, count) ==
         KB_ERROR_INVALID_ARGUMENT;
}

void TestGroupingArguments(kb_engine* engine) {
  const std::vector<int32_t> too_many(KB_MAX_GRID_GROUPS + 1, 1);
  const std::vector<int32_t> most(KB_MAX_GRID_GROUPS, 1);
  const int32_t zero_group[] = {3, 0, 2};
  const int32_t past_bar[] = {Metronome::kMaxBeats, 1};
  Check(
      Refuses(nullptr, kThreeTwoTwo, 3) && Refuses(engine, nullptr, 3) &&
          Refuses(engine, kThreeTwoTwo, -1) &&
          Refuses(engine, too_many.data(), KB_MAX_GRID_GROUPS + 1) &&
          Refuses(engine, zero_group, 3) && Refuses(engine, past_bar, 2),
      "set_grid_grouping: refuses a bad count, group or sum"
  );
  Check(
      kb_metronome_set_grid_grouping(engine, kThreeTwoTwo, 3) == KB_OK &&
          kb_metronome_set_grid_grouping(
              engine,
              most.data(),
              KB_MAX_GRID_GROUPS
          ) == KB_OK &&
          kb_metronome_set_grid_grouping(engine, nullptr, 0) == KB_OK,
      "set_grid_grouping: accepts a grouping, the most groups and a clear"
  );
}

void TestRateArguments(kb_engine* engine) {
  Check(
      kb_metronome_set_grid_rate(nullptr, KB_GRID_RATE_DOUBLE) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_metronome_set_grid_rate(engine, -1) == KB_ERROR_INVALID_ARGUMENT &&
          kb_metronome_set_grid_rate(engine, kUnknownRate) ==
              KB_ERROR_INVALID_ARGUMENT,
      "set_grid_rate: refuses a null engine and an unknown rate"
  );
  Check(
      kb_metronome_set_grid_rate(engine, KB_GRID_RATE_SINGLE) == KB_OK &&
          kb_metronome_set_grid_rate(engine, KB_GRID_RATE_DOUBLE) == KB_OK &&
          kb_metronome_set_grid_rate(engine, KB_GRID_RATE_HALF) == KB_OK,
      "set_grid_rate: accepts every kb_grid_rate"
  );
}

void TestFullRing() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  for (size_t i = 0; i < Metronome::kCommandRingSize; ++i) {
    kb_metronome_set_tempo(engine, Metronome::kDefaultBpm);
  }
  Check(
      kb_metronome_set_grid_grouping(engine, kThreeTwoTwo, 3) ==
              KB_ERROR_BUSY &&
          kb_metronome_set_grid_rate(engine, KB_GRID_RATE_HALF) ==
              KB_ERROR_BUSY,
      "grid click: a full ring refuses rather than reporting a dropped command"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunGridClickAbiTests() {
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "grid click: engine opens");
  if (engine == nullptr) return;
  TestGroupingArguments(engine);
  TestRateArguments(engine);
  kb_engine_destroy(engine);
  TestFullRing();
}

}  // namespace abi_test
