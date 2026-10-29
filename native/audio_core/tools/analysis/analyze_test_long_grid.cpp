#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>

#include "analysis/beat_tracker.h"
#include "analysis/onset_envelope.h"
#include "analysis/song_analysis.h"
#include "check.h"
#include "media/audio_source.h"

namespace analyze_test {
namespace {

using kitbag_test::Check;

constexpr int32_t kPre161Cap = 8192;
// 49 min at 184.6 BPM: an integer hop count per beat, so the tracker's period
// is exact and every click is a beat it must place.
constexpr uint32_t kLongRate = 11025;
constexpr uint64_t kHopsPerBeat = 7;
constexpr uint64_t kBeatFrames = kHopsPerBeat * kitbag::kOnsetHopSize;
constexpr uint64_t kClicks = 9100;
constexpr uint64_t kClickFrames = 64;
constexpr float kClickAmp = 0.8f;
constexpr uint64_t kMissableBeats = 2;
static_assert(kClicks > kPre161Cap && kClicks <= KB_MAX_GRID_BEATS);

class LongClickReader : public kitbag::SourceReader {
 public:
  uint32_t channels() const override {
    return 1;
  }
  uint32_t sample_rate() const override {
    return kLongRate;
  }
  uint64_t total_frames() const override {
    return kFrames;
  }

  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    uint64_t n = 0;
    for (; n < frames && position_ < kFrames; ++n, ++position_) {
      dst[n] = position_ % kBeatFrames < kClickFrames ? kClickAmp : 0.0f;
    }
    return {
        n,
        n == frames ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > kFrames) return false;
    position_ = frame;
    return true;
  }

 private:
  static constexpr uint64_t kFrames = kClicks * kBeatFrames;
  uint64_t position_ = 0;
};

void TestGridCoversWholeLongSong() {
  LongClickReader reader;
  kitbag::BeatResult result;
  const kb_result status =
      kitbag::AnalyzeSong(reader, "long", nullptr, &result);
  const size_t beats = result.beat_times.size();
  const double beat_sec = static_cast<double>(kBeatFrames) / kLongRate;
  const double last_click_sec = static_cast<double>(kClicks - 1) * beat_sec;
  std::printf(
      "analyze_verify: long song %llu clicks -> %zu beats, last at %.1f s of "
      "%.1f s\n",
      static_cast<unsigned long long>(kClicks),
      beats,
      beats > 0 ? static_cast<double>(result.beat_times.back()) : 0.0,
      last_click_sec
  );
  Check(status == KB_OK, "long grid: a 49-minute song analyses to KB_OK");
  Check(
      beats + kMissableBeats >= kClicks && beats <= kClicks,
      "long grid: every click past the pre-#161 cap is a beat"
  );
  Check(
      beats > 0 && std::fabs(result.beat_times.back() - last_click_sec) <
                       static_cast<double>(kMissableBeats) * beat_sec,
      "long grid: the last beat sits at the song's last click"
  );
}

}  // namespace

void RunLongGridTests() {
  TestGridCoversWholeLongSong();
}

}  // namespace analyze_test
