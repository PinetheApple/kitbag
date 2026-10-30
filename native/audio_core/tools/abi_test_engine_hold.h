#ifndef KITBAG_TOOLS_ABI_TEST_ENGINE_HOLD_H
#define KITBAG_TOOLS_ABI_TEST_ENGINE_HOLD_H

#include "kitbag_api.h"

#include <chrono>
#include <thread>

namespace abi_test {

using Clock = std::chrono::steady_clock;

inline constexpr auto kPoll = std::chrono::milliseconds(10);
inline constexpr auto kStopWithin = std::chrono::milliseconds(1500);
inline constexpr auto kSeveralWatchTicks = std::chrono::milliseconds(700);

inline bool StopsWithin(const kb_engine* engine) {
  const Clock::time_point deadline = Clock::now() + kStopWithin;
  while (kb_engine_device_running(engine) == 1) {
    if (Clock::now() > deadline) return false;
    std::this_thread::sleep_for(kPoll);
  }
  return true;
}

void RunEngineHoldAbiTests();
void RunEngineLifecycleStress();

}  // namespace abi_test

#endif  // KITBAG_TOOLS_ABI_TEST_ENGINE_HOLD_H
