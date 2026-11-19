#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/onset_envelope.h"
#include "analyze_test_support.h"
#include "check.h"
#include "metronome/metronome_internal.h"

namespace analyze_test {
namespace {

using kitbag::BeatResult;
using kitbag::kOnsetHopSize;
using kitbag::metronome_detail::kSecondsPerMinute;
using kitbag_test::Check;

constexpr double LagBpm(double lag_hops) {
  return kSecondsPerMinute * kSampleRate / (lag_hops * kOnsetHopSize);
}

// Half a hop off the lag grid is the worst rounding; a whole lag is the control.
constexpr std::array<double, 2> kStemTempos = {LagBpm(29.5), LagBpm(30.0)};
constexpr int kStemBeats = 160;
constexpr int kBeatsPerChord = 2;
constexpr std::array<float, 4> kChordRootsHz =
    {110.0f, 146.83f, 164.81f, 92.5f};
constexpr std::array<float, 3> kChordRatios = {1.0f, 1.26f, 1.5f};
constexpr float kChordAmp = 0.1f;
// The held pad means no beat starts from silence, so no onset is sharper than
// its attack.
constexpr float kPadAmp = 0.03f;
constexpr float kChordDecayPerSec = 2.0f;
constexpr float kMinAttackSec = 0.06f;
constexpr float kAttackStepSec = 0.01f;
constexpr int kAttackSteps = 5;
constexpr int kAttackStride = 3;
constexpr double kMaxTempoErrorBpm = 0.25;
constexpr double kMaxStemSpreadBpm = 1.0;
constexpr double kMaxGridLengthSpread = 0.01;
// Louder noise leaves no beat peak at all and quieter noise no slope, so the
// pad sits inside a narrow band.
constexpr double kSwellLagHops = 31.2;
constexpr float kSwellAttackSec = 0.22f;
constexpr float kSwellChordAmp = 0.1f;
constexpr float kSwellNoiseAmp = 0.022f;
constexpr int kSwellBeatsPerBar = 4;
constexpr uint32_t kSwellNoiseSeed = 7u;

size_t BeatFrame(int beat, double bpm) {
  const double period = kSecondsPerMinute * kSampleRate / bpm;
  return static_cast<size_t>(std::lround(beat * period));
}

void SetFrame(std::vector<float>& pcm, size_t frame, float v) {
  pcm[frame * 2] = v;
  pcm[frame * 2 + 1] = v;
}

std::vector<float> MakeClickStem(double bpm) {
  std::vector<float> pcm(BeatFrame(kStemBeats, bpm) * 2, 0.0f);
  for (int b = 0; b < kStemBeats; ++b) {
    const size_t start = BeatFrame(b, bpm);
    for (int s = 0; s < kClickWidth; ++s) SetFrame(pcm, start + s, kClickAmp);
  }
  return pcm;
}

float AttackSec(int beat) {
  return kMinAttackSec +
         kAttackStepSec *
             static_cast<float>(beat * kAttackStride % kAttackSteps);
}

float Chord(int beat, float song_t) {
  const float root =
      kChordRootsHz[(beat / kBeatsPerChord) % kChordRootsHz.size()];
  float v = 0.0f;
  for (const float ratio : kChordRatios) {
    v += std::sin(kTwoPi * root * ratio * song_t);
  }
  return v;
}

std::vector<float> MakeChordStem(double bpm) {
  std::vector<float> pcm(BeatFrame(kStemBeats, bpm) * 2, 0.0f);
  const float rate = static_cast<float>(kSampleRate);
  for (int b = 0; b < kStemBeats; ++b) {
    const size_t start = BeatFrame(b, bpm);
    const size_t end = BeatFrame(b + 1, bpm);
    for (size_t f = start; f < end; ++f) {
      const float t = static_cast<float>(f - start) / rate;
      const float song_t = static_cast<float>(f) / rate;
      const float envelope =
          std::fmin(t / AttackSec(b), 1.0f) * std::exp(-t * kChordDecayPerSec);
      SetFrame(pcm, f, (kChordAmp * envelope + kPadAmp) * Chord(b, song_t));
    }
  }
  return pcm;
}

float BarSwell(size_t frame, double bar_frames) {
  const auto phase =
      static_cast<float>(static_cast<double>(frame) / bar_frames);
  return 0.5f - 0.5f * std::cos(kTwoPi * phase);
}

// Noise swelling once a bar slopes the onset autocorrelation, so the chords'
// broad beat peak crests short of the period while its double does not.
std::vector<float> MakeSwellingPadStem(double bpm) {
  std::vector<float> pcm(BeatFrame(kStemBeats, bpm) * 2, 0.0f);
  const float rate = static_cast<float>(kSampleRate);
  const double bar_frames =
      kSecondsPerMinute * kSampleRate / bpm * kSwellBeatsPerBar;
  uint32_t noise = kSwellNoiseSeed;
  for (int b = 0; b < kStemBeats; ++b) {
    const size_t start = BeatFrame(b, bpm);
    const size_t end = BeatFrame(b + 1, bpm);
    for (size_t f = start; f < end; ++f) {
      const float t = static_cast<float>(f - start) / rate;
      const float attack = std::fmin(t / kSwellAttackSec, 1.0f);
      const float chord =
          kSwellChordAmp * attack * Chord(b, static_cast<float>(f) / rate);
      const float pad =
          kSwellNoiseAmp * BarSwell(f, bar_frames) * LcgNoise(noise);
      SetFrame(pcm, f, chord + pad);
    }
  }
  return pcm;
}

void CheckSwellingPadAgrees() {
  const double bpm = LagBpm(kSwellLagHops);
  const BeatResult clicks = AnalyzePcm(MakeClickStem(bpm));
  const BeatResult pad = AnalyzePcm(MakeSwellingPadStem(bpm));
  const auto click_beats = static_cast<double>(clicks.beat_times.size());
  const auto pad_beats = static_cast<double>(pad.beat_times.size());
  std::printf(
      "analyze_verify: swelling pad at %.2f BPM -> clicks %.2f (%zu beats), "
      "pad %.2f (%zu beats)\n",
      bpm,
      clicks.bpm,
      clicks.beat_times.size(),
      pad.bpm,
      pad.beat_times.size()
  );
  Check(
      std::fabs(clicks.bpm - bpm) <= kMaxTempoErrorBpm,
      "stems: the swelling pad's click stem reads the played tempo"
  );
  Check(
      std::fabs(pad.bpm - clicks.bpm) <= kMaxStemSpreadBpm,
      "stems: a swelling slow-attack pad reads its click stem's tempo"
  );
  Check(
      std::fabs(pad_beats - click_beats) <= kMaxGridLengthSpread * click_beats,
      "stems: a swelling slow-attack pad's grid matches its click stem's "
      "length within 1%"
  );
}

void CheckStemsAgree(double bpm) {
  const BeatResult clicks = AnalyzePcm(MakeClickStem(bpm));
  const BeatResult chords = AnalyzePcm(MakeChordStem(bpm));
  std::printf(
      "analyze_verify: stems at %.2f BPM -> clicks %.2f (%zu beats), "
      "chords %.2f (%zu beats)\n",
      bpm,
      clicks.bpm,
      clicks.beat_times.size(),
      chords.bpm,
      chords.beat_times.size()
  );
  Check(
      std::fabs(clicks.bpm - bpm) <= kMaxTempoErrorBpm,
      "stems: the click stem reads the played tempo within 0.25 BPM"
  );
  Check(
      std::fabs(chords.bpm - bpm) <= kMaxTempoErrorBpm,
      "stems: the slow-attack chord stem reads the played tempo within 0.25 BPM"
  );
  Check(
      std::fabs(clicks.bpm - chords.bpm) <= kMaxStemSpreadBpm,
      "stems: two stems of one tempo agree within 1 BPM"
  );
}

// A gap mid-grid is the worst case: half the pairwise slopes span it.
void CheckSkippedBeat(double bpm) {
  const double period = kSecondsPerMinute / bpm;
  std::vector<float> beats;
  for (int b = 0; b < kStemBeats; ++b) {
    if (b != kStemBeats / 2) beats.push_back(static_cast<float>(b * period));
  }
  const float fitted = kitbag::BeatGridBpm(beats);
  std::printf(
      "analyze_verify: %.2f BPM grid, one beat skipped -> %.2f\n",
      bpm,
      fitted
  );
  Check(
      std::fabs(fitted - bpm) <= kMaxTempoErrorBpm,
      "stems: a skipped beat mid-grid does not bias the tempo"
  );
}

}  // namespace

void RunStemTests() {
  for (const double bpm : kStemTempos) CheckStemsAgree(bpm);
  CheckSkippedBeat(kStemTempos[0]);
  CheckSwellingPadAgrees();
}

}  // namespace analyze_test
