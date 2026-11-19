#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/onset_envelope.h"
#include "analyze_test_support.h"
#include "beat_spacing.h"
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
// Louder noise leaves no beat peak and quieter noise no slope; a weaker accent
// leaves the double-lag peak under the gain gate.
constexpr double kSwellLagHops = 31.2;
constexpr float kSwellAttackSec = 0.2f;
constexpr float kSwellNoiseAmp = 0.06f;
constexpr int kSwellBeats = 24;
constexpr uint32_t kSwellNoiseSeed = 7u;
constexpr float kSwellAccentAmp = 0.18f;
// Read at a lag near min_lag, whose double-lag peak halves below it.
constexpr double kEdgeLagHops = 91.0;
constexpr float kEdgeAttackSec = 0.1f;
constexpr float kEdgeNoiseAmp = 0.01f;
constexpr float kEdgeAccentAmp = 0.3f;
constexpr int kEdgeBeats = 60;
constexpr float kAccentAttackSec = 0.01f;
constexpr float kAccentDecayPerSec = 8.0f;
constexpr int kRippleBeats = 200;
constexpr float kRippleChordAttackSec = 0.1f;
constexpr float kRippleRiseSec = 0.35f;
constexpr float kRippleNoteSec = 2.0f * kRippleRiseSec;
constexpr float kRippleDecayPerSec = 4.0f;
constexpr float kRipplePerSec = 8.0f;
constexpr float kRippleAmp = 0.6f;
constexpr float kRippleBaseHz = 440.0f;
constexpr uint32_t kRipplePitchSteps = 24;
constexpr float kSemitonesPerOctave = 12.0f;
constexpr uint32_t kRippleSeed = 126u;

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

float Swell(size_t frame, double swell_frames) {
  const auto phase =
      static_cast<float>(static_cast<double>(frame) / swell_frames);
  return 0.5f - 0.5f * std::cos(kTwoPi * phase);
}

struct PadShape {
  double bpm;
  int beats;
  float attack_sec;
  float noise_amp;
  float accent_amp;
};

float Accent(const PadShape& shape, int beat, float t) {
  if (beat % kBeatsPerChord != 0) return 0.0f;
  return shape.accent_amp * std::fmin(t / kAccentAttackSec, 1.0f) *
         std::exp(-t * kAccentDecayPerSec);
}

std::vector<float> MakeSwellingPadStem(const PadShape& shape) {
  std::vector<float> pcm(BeatFrame(shape.beats, shape.bpm) * 2, 0.0f);
  const float rate = static_cast<float>(kSampleRate);
  const double swell_frames =
      kSecondsPerMinute * kSampleRate / shape.bpm * kSwellBeats;
  uint32_t noise = kSwellNoiseSeed;
  for (int b = 0; b < shape.beats; ++b) {
    const size_t start = BeatFrame(b, shape.bpm);
    const size_t end = BeatFrame(b + 1, shape.bpm);
    for (size_t f = start; f < end; ++f) {
      const float t = static_cast<float>(f - start) / rate;
      const float level = kChordAmp * std::fmin(t / shape.attack_sec, 1.0f) +
                          Accent(shape, b, t);
      const float chord = level * Chord(b, static_cast<float>(f) / rate);
      const float pad =
          shape.noise_amp * Swell(f, swell_frames) * LcgNoise(noise);
      SetFrame(pcm, f, chord + pad);
    }
  }
  return pcm;
}

void CheckEdgeStaysInRange() {
  const PadShape shape{
      LagBpm(kEdgeLagHops),
      kEdgeBeats,
      kEdgeAttackSec,
      kEdgeNoiseAmp,
      kEdgeAccentAmp
  };
  const BeatResult r = AnalyzePcm(MakeSwellingPadStem(shape));
  std::printf(
      "analyze_verify: pad at %.2f BPM, doubled lag past the range -> %.2f\n",
      shape.bpm,
      r.bpm
  );
  Check(
      r.bpm <= kitbag::kMaxTrackedBpm * (1.0 + kBpmTolerance),
      "stems: a refined tempo never leaves the tracked range"
  );
}

void AddRippleNote(std::vector<float>& pcm, size_t start, float hz) {
  const float rate = static_cast<float>(kSampleRate);
  const auto length = static_cast<size_t>(kRippleNoteSec * rate);
  const size_t frames = pcm.size() / 2;
  for (size_t f = start; f < start + length && f < frames; ++f) {
    const float t = static_cast<float>(f - start) / rate;
    const float level =
        t < kRippleRiseSec
            ? t / kRippleRiseSec
            : std::exp(-(t - kRippleRiseSec) * kRippleDecayPerSec);
    const float v = kRippleAmp * level * std::sin(kTwoPi * hz * t);
    pcm[f * 2] += v;
    pcm[f * 2 + 1] += v;
  }
}

// Slow-rising notes off the grid under steady chords: the beat lag is already
// right, and the strongest peak near its double is a ripple in a trough.
std::vector<float> MakeRippleStem(double bpm) {
  std::vector<float> pcm(BeatFrame(kRippleBeats, bpm) * 2, 0.0f);
  const float rate = static_cast<float>(kSampleRate);
  for (int b = 0; b < kRippleBeats; ++b) {
    const size_t start = BeatFrame(b, bpm);
    for (size_t f = start; f < BeatFrame(b + 1, bpm); ++f) {
      const float t = static_cast<float>(f - start) / rate;
      const float level =
          kChordAmp * std::fmin(t / kRippleChordAttackSec, 1.0f);
      SetFrame(pcm, f, level * Chord(b, static_cast<float>(f) / rate));
    }
  }
  uint32_t state = kRippleSeed;
  const double song_sec = static_cast<double>(pcm.size() / 2) / kSampleRate;
  double t = -std::log(1.0 - LcgUniform(state)) / kRipplePerSec;
  while (t < song_sec) {
    const auto step = static_cast<uint32_t>(
        LcgUniform(state) * static_cast<double>(kRipplePitchSteps)
    );
    const float hz = kRippleBaseHz *
                     std::exp2(static_cast<float>(step) / kSemitonesPerOctave);
    AddRippleNote(pcm, static_cast<size_t>(t * kSampleRate), hz);
    t -= std::log(1.0 - LcgUniform(state)) / kRipplePerSec;
  }
  return pcm;
}

void CheckRippleKeepsTempo() {
  const double bpm = LagBpm(kSwellLagHops);
  const BeatResult r = AnalyzePcm(MakeRippleStem(bpm));
  std::printf(
      "analyze_verify: off-grid ripple at %.2f BPM -> %.2f (%zu beats)\n",
      bpm,
      r.bpm,
      r.beat_times.size()
  );
  Check(
      std::fabs(r.bpm - bpm) <= kMaxStemSpreadBpm,
      "stems: a ripple near the doubled lag leaves a right tempo alone"
  );
}

void CheckSwellingPadAgrees() {
  const double bpm = LagBpm(kSwellLagHops);
  const BeatResult clicks = AnalyzePcm(MakeClickStem(bpm));
  const PadShape
      shape{bpm, kStemBeats, kSwellAttackSec, kSwellNoiseAmp, kSwellAccentAmp};
  const BeatResult pad = AnalyzePcm(MakeSwellingPadStem(shape));
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
  CheckRippleKeepsTempo();
  CheckEdgeStaysInRange();
}

}  // namespace analyze_test
