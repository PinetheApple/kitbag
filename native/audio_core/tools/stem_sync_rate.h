#ifndef KITBAG_TOOLS_STEM_SYNC_RATE_H
#define KITBAG_TOOLS_STEM_SYNC_RATE_H

#include "kitbag_api.h"

#include <cstdint>
#include <string>
#include <vector>

namespace stem_sync {

constexpr uint32_t kRate = 48000;
constexpr uint32_t kStereo = 2;
// No rate under test scales this to whole frames, so a lost fraction drifts.
constexpr uint32_t kBlock = 333;
constexpr double kUnity = 1.0;
constexpr int kBeatCount = 36;

struct Take {
  std::vector<float> left;
  std::vector<float> right;
};

std::vector<double> Beats();
int64_t SongFrames();
std::string WritePulseStem();
kb_engine* OpenFollowingEngine(const std::string& stem);
void RenderPaced(kb_engine* engine, Take* take, int blocks);
std::vector<int64_t> DetectClicks(const std::vector<float>& right);

void RunScriptTests(const std::string& stem);
void RunLockTests(const std::string& stem);
void RunReanchorTests(const std::string& stem);

}  // namespace stem_sync

#endif  // KITBAG_TOOLS_STEM_SYNC_RATE_H
