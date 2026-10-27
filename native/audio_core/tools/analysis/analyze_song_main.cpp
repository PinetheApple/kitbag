#include "kitbag_api.h"

#include <sys/resource.h>

#include <cstdio>
#include <vector>

namespace {

constexpr int kCap = KB_MAX_GRID_BEATS;

long PeakRssKib() {
  rusage usage{};
  getrusage(RUSAGE_SELF, &usage);
  return usage.ru_maxrss;
}

void PrintResult(
    float bpm,
    const std::vector<float>& beats,
    int beat_count,
    const std::vector<int32_t>& downbeats,
    int downbeat_count
) {
  std::printf("bpm %.6f\nbeats %d\n", bpm, beat_count);
  for (int i = 0; i < beat_count; ++i) std::printf("%.6f\n", beats[i]);
  std::printf("downbeats %d\n", downbeat_count);
  for (int i = 0; i < downbeat_count; ++i) std::printf("%d\n", downbeats[i]);
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: analyze_song <audio file> [waveform dir]\n");
    return 2;
  }
  std::vector<float> beats(kCap);
  std::vector<int32_t> downbeats(kCap);
  float bpm = 0.0f;
  int32_t beat_count = 0;
  int32_t downbeat_count = 0;
  const kb_result status = kb_analyze_song(
      argv[1],
      &bpm,
      beats.data(),
      kCap,
      &beat_count,
      downbeats.data(),
      &downbeat_count,
      argc > 2 ? argv[2] : nullptr
  );
  std::printf("status %d\n", static_cast<int>(status));
  PrintResult(bpm, beats, beat_count, downbeats, downbeat_count);
  std::fprintf(stderr, "peak_rss_kib %ld\n", PeakRssKib());
  return status == KB_OK ? 0 : 1;
}
