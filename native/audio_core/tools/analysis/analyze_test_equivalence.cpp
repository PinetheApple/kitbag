// Streaming analysis (#160) against a frozen copy of the whole-buffer code it
// replaced: downmix, STFT onset flux and waveform peaks (the Ref* functions; do
// not update them to track src/). Downbeats are checked against QM-DSP's own
// DownBeat::findDownBeats. Tempo and beat placement were not rewritten, so both
// sides share BeatTracker::AnalyzeFlux and this does not test them.
#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/downbeat.h"
#include "analysis/onset_envelope.h"
#include "analysis/sidecar_path.h"
#include "analysis/song_analysis.h"
#include "analysis/waveform_peaks.h"
#include "analyze_buffer_driver.h"
#include "analyze_test_support.h"
#include "check.h"
#include "dsp/fft.h"
#include "dsp/tempotracking/DownBeat.h"

namespace analyze_test {

namespace {

constexpr int kFftSize = 2048;
constexpr int kHopSize = 512;
constexpr int kDecimationFactor = 16;
constexpr int kDfIncrement = 512;
constexpr int kBeatsPerBar = 4;
// Not a divisor of the hop, the decimator block or the read chunk, so every
// streaming analyser sees pieces that straddle its internal boundaries.
constexpr size_t kOddPiece = 1000;

struct Fixture {
  const char* name;
  std::vector<float> pcm;
  uint32_t channels;
  uint32_t rate;
};

std::vector<float>
RefDownmix(const std::vector<float>& pcm, uint32_t channels) {
  const size_t frames = pcm.size() / channels;
  std::vector<float> mono(frames);
  for (size_t f = 0; f < frames; ++f) {
    float sum = 0.0f;
    for (uint32_t ch = 0; ch < channels; ++ch) sum += pcm[f * channels + ch];
    mono[f] = sum / static_cast<float>(channels);
  }
  return mono;
}

float RefFrameFlux(
    const std::vector<float>& mono,
    int offset,
    const std::vector<float>& window,
    std::vector<float>& prev_mag
) {
  std::vector<float> buf(2 * kFftSize);
  const int n = static_cast<int>(mono.size());
  for (int i = 0; i < kFftSize; ++i) {
    buf[2 * i] = offset + i < n ? mono[offset + i] * window[i] : 0.0f;
    buf[2 * i + 1] = 0.0f;
  }
  kitbag::fft(buf.data(), kFftSize, false);
  float flux = 0.0f;
  for (size_t i = 0; i < prev_mag.size(); ++i) {
    const float mag =
        std::sqrt(buf[2 * i] * buf[2 * i] + buf[2 * i + 1] * buf[2 * i + 1]);
    if (mag - prev_mag[i] > 0.0f) flux += mag - prev_mag[i];
    prev_mag[i] = mag;
  }
  return flux / static_cast<float>(prev_mag.size());
}

std::vector<float> RefFlux(const std::vector<float>& mono) {
  const int n = static_cast<int>(mono.size());
  const int frames = std::max(0, (n - kFftSize) / kHopSize) + 1;
  std::vector<float> window(kFftSize);
  kitbag::fft_hann(window.data(), kFftSize);
  std::vector<float> prev_mag(kFftSize / 2 + 1, 0.0f);
  std::vector<float> flux(frames);
  for (int f = 0; f < frames; ++f) {
    flux[f] = RefFrameFlux(mono, f * kHopSize, window, prev_mag);
  }
  return flux;
}

struct RefDownbeats {
  std::vector<int> indices;
  std::vector<double> sd;
};

RefDownbeats RefFindDownbeats(
    const std::vector<float>& mono,
    int rate,
    const std::vector<float>& beat_times
) {
  DownBeat db(static_cast<float>(rate), kDecimationFactor, kDfIncrement);
  db.setBeatsPerBar(kBeatsPerBar);
  std::vector<float> block(kDfIncrement);
  for (size_t off = 0; off < mono.size(); off += kDfIncrement) {
    for (size_t i = 0; i < block.size(); ++i) {
      block[i] = off + i < mono.size() ? mono[off + i] : 0.0f;
    }
    db.pushAudioBlock(block.data());
  }
  std::vector<double> beats;
  for (const float t : beat_times) {
    beats.push_back(
        static_cast<double>(t) * rate / static_cast<double>(kDfIncrement)
    );
  }
  size_t ds_len = 0;
  const float* ds = db.getBufferedAudio(ds_len);
  RefDownbeats out;
  db.findDownBeats(ds, ds_len, beats, out.indices);
  db.getBeatSD(out.sd);
  return out;
}

std::vector<int16_t>
RefPeaks(const std::vector<float>& pcm, uint32_t channels) {
  const int frames = static_cast<int>(pcm.size() / channels);
  const int ch = static_cast<int>(channels);
  const int chunk = std::max(1, frames / kitbag::kWaveformTargetChunks);
  const int chunks = frames / chunk;
  std::vector<int16_t> out(static_cast<size_t>(chunks) * ch * 2);
  for (int c = 0; c < chunks; ++c) {
    for (int k = 0; k < ch; ++k) {
      float lo = 1.0f;
      float hi = -1.0f;
      for (int s = c * chunk * ch + k; s < (c + 1) * chunk * ch; s += ch) {
        if (pcm[s] < lo) lo = pcm[s];
        if (pcm[s] > hi) hi = pcm[s];
      }
      out[(c * ch + k) * 2] =
          static_cast<int16_t>(std::clamp(lo, -1.0f, 1.0f) * 32767.0f);
      out[(c * ch + k) * 2 + 1] =
          static_cast<int16_t>(std::clamp(hi, -1.0f, 1.0f) * 32767.0f);
    }
  }
  return out;
}

std::vector<float> StreamedFlux(const std::vector<float>& mono) {
  kitbag::OnsetEnvelope onset;
  for (size_t off = 0; off < mono.size(); off += kOddPiece) {
    onset.Push(mono.data() + off, std::min(kOddPiece, mono.size() - off));
  }
  return onset.TakeFlux();
}

std::vector<double> StreamedBeatSd(
    const std::vector<float>& mono,
    int rate,
    const std::vector<float>& beat_times,
    std::vector<int>* downbeats
) {
  kitbag::DownbeatTracker tracker(rate, beat_times, mono.size(), kBeatsPerBar);
  for (size_t off = 0; off < mono.size(); off += kOddPiece) {
    tracker.Push(mono.data() + off, std::min(kOddPiece, mono.size() - off));
  }
  *downbeats = tracker.Finish();
  return tracker.beat_sd();
}

kitbag::BeatResult AnalyzeStreamed(const Fixture& fx, const std::string& dir) {
  kitbag::DecoderInfo info;
  info.channels = fx.channels;
  info.sample_rate = fx.rate;
  kitbag::BeatResult result;
  AnalyzeDecodedPcm(
      fx.pcm.data(),
      fx.pcm.size() / fx.channels,
      info,
      fx.name,
      dir.c_str(),
      &result
  );
  return result;
}

void CheckPipeline(
    const Fixture& fx,
    const std::filesystem::path& dir,
    const kitbag::BeatResult& ref,
    const RefDownbeats& ref_db
) {
  const kitbag::BeatResult got = AnalyzeStreamed(fx, dir.string());
  kitbag_test::Check(
      got.bpm == ref.bpm && got.beat_times == ref.beat_times,
      "equivalence: bpm and every beat time identical"
  );
  kitbag_test::Check(
      got.downbeat_indices == ref_db.indices,
      "equivalence: downbeats identical to QM DownBeat"
  );
  const std::string kwav = kitbag::SidecarPath(dir.string().c_str(), fx.name);
  Sidecar sidecar;
  kitbag_test::Check(
      ReadSidecar(kwav, &sidecar) &&
          sidecar.data == RefPeaks(fx.pcm, fx.channels),
      "equivalence: sidecar peaks identical to whole-buffer"
  );
  std::filesystem::remove(kwav);
}

void ReportSdDifference(
    const std::vector<double>& got,
    const std::vector<double>& want
) {
  if (got.size() != want.size()) {
    std::fprintf(
        stderr,
        "  sd sizes differ: %zu vs %zu\n",
        got.size(),
        want.size()
    );
    return;
  }
  for (size_t i = 0; i < got.size(); ++i) {
    if (got[i] != want[i]) {
      std::fprintf(stderr, "  sd[%zu]: %.17g vs %.17g\n", i, got[i], want[i]);
      return;
    }
  }
}

void CheckFixture(const Fixture& fx, const std::filesystem::path& dir) {
  const std::vector<float> mono = RefDownmix(fx.pcm, fx.channels);
  const int rate = static_cast<int>(fx.rate);
  const std::vector<float> flux = RefFlux(mono);
  const kitbag::BeatResult ref = kitbag::BeatTracker().AnalyzeFlux(flux, rate);
  const RefDownbeats ref_db = RefFindDownbeats(mono, rate, ref.beat_times);
  kitbag_test::Check(
      ref.bpm > 0.0f && !ref_db.indices.empty() && !ref_db.sd.empty(),
      "equivalence: reference finds a tempo, beats and downbeats to compare"
  );
  kitbag_test::Check(
      StreamedFlux(mono) == flux,
      "equivalence: streamed onset flux equals whole-buffer STFT"
  );

  CheckPipeline(fx, dir, ref, ref_db);
  std::vector<int> streamed_db;
  const std::vector<double> sd =
      StreamedBeatSd(mono, rate, ref.beat_times, &streamed_db);
  kitbag_test::Check(
      sd == ref_db.sd && streamed_db == ref_db.indices,
      "equivalence: beat spectral differences identical to QM"
  );
  ReportSdDifference(sd, ref_db.sd);
}

// 48 kHz, a length off every block size, and 1.3 s of leading silence so the
// downbeat tracker discards audio before beat one. Channels 1-2 click at their
// own period, so a downmix that is not the mean of all three moves the grid.
Fixture MakeOddFixture() {
  constexpr uint32_t kChannels = 3;
  constexpr size_t kLeadFrames = 62400;
  constexpr size_t kTailFrames = 777;
  constexpr size_t kSidePeriod = 15013;
  const std::vector<float> stereo = MakeBarToneTrack(true);
  const size_t frames = kLeadFrames + stereo.size() / 2 + kTailFrames;
  std::vector<float> pcm(frames * kChannels, 0.0f);
  for (size_t f = 0; f < frames; ++f) {
    float* out = &pcm[f * kChannels];
    const bool in_track =
        f >= kLeadFrames && f - kLeadFrames < stereo.size() / 2;
    out[0] = in_track ? stereo[(f - kLeadFrames) * 2] : 0.0f;
    const float side = f % kSidePeriod < kClickWidth ? kClickAmp : 0.0f;
    out[1] = side;
    out[2] = -0.5f * side;
  }
  return {"equiv_odd", pcm, kChannels, 48000};
}

// A grid the tracker never emits, aimed at the tracker's edge paths: a 1.8 s
// beat longer than the 4096-sample beat frame, a zero-length duplicate, and a
// beat past the end of the audio, which DownBeat clamps.
void CheckIrregularGrid() {
  const std::vector<float> mono = RefDownmix(MakeBarToneTrack(true), 2);
  const float past_end = static_cast<float>(mono.size()) / kSampleRate + 1.0f;
  const std::vector<float> grid =
      {0.05f, 0.5f, 2.3f, 2.3f, 2.9f, 3.4f, 3.9f, 4.4f, 4.9f, 5.4f, past_end};
  const int rate = static_cast<int>(kSampleRate);
  const RefDownbeats ref = RefFindDownbeats(mono, rate, grid);
  std::vector<int> streamed_db;
  const std::vector<double> sd = StreamedBeatSd(mono, rate, grid, &streamed_db);
  kitbag_test::Check(
      !ref.sd.empty() && sd == ref.sd && streamed_db == ref.indices,
      "equivalence: long, empty and past-end beats match QM DownBeat"
  );
  ReportSdDifference(sd, ref.sd);
}

}  // namespace

void RunEquivalenceTests(const std::filesystem::path& dir) {
  CheckFixture({"equiv_clicks", MakeClickTrack(), 2, kSampleRate}, dir);
  CheckFixture({"equiv_accented", MakeBarToneTrack(true), 2, kSampleRate}, dir);
  CheckFixture({"equiv_control", MakeBarToneTrack(false), 2, kSampleRate}, dir);
  CheckFixture(MakeOddFixture(), dir);
  CheckIrregularGrid();
}

}  // namespace analyze_test
