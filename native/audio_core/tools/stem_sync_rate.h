#ifndef KITBAG_TOOLS_STEM_SYNC_RATE_H
#define KITBAG_TOOLS_STEM_SYNC_RATE_H

#include "kitbag_api.h"

#include <cstdint>
#include <string>
#include <vector>

namespace stem_sync {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kStereo = 2;
// No slowed rate scales this to whole frames, so a lost fraction drifts.
constexpr uint32_t kBlock = 333;
constexpr int kBeatCount = 36;
// Well under the stretch latency this guards (over 60 ms); what is left is the
// vocoder's smear of a pulse's centre.
constexpr double kMaxLockMs = 1.5;
constexpr double kMsPerSecond = 1000.0;
constexpr int64_t kSongWindowFrames = 9000;

struct Take {
  std::vector<float> left;
  std::vector<float> right;
};

std::vector<double> Beats();
int64_t SongFrames();
std::string WritePulseStem();
kb_engine* OpenFollowingEngine(const std::string& stem);
void RenderPaced(kb_engine* engine, Take* take, int blocks);
// The stem's centre of energy, left minus right, within half_width of around.
double PulseCentre(const Take& take, int64_t around, int64_t half_width);

void RunScriptTests(const std::string& stem);
void RunLockTests(const std::string& stem);
void RunReanchorTests(const std::string& stem);
void RunBarTests(const std::string& stem);
void RunCountInTests(const std::string& pulses);

}  // namespace stem_sync

#endif  // KITBAG_TOOLS_STEM_SYNC_RATE_H
