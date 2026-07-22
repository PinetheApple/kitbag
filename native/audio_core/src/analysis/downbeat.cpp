// Downbeat labelling behind kb_analyze_song. App thread only — allocates freely,
// never runs on the audio callback.
#include "analysis/downbeat.h"

#include "dsp/tempotracking/DownBeat.h"

namespace kitbag {

namespace {

// 16x decimation puts 44.1/48k near DownBeat's expected ~2.7kHz working rate.
constexpr int kDecimationFactor = 16;
// Beat-grid unit fed to DownBeat, in original-rate frames per unit. Also the
// audio block size pushAudioBlock consumes; a multiple of kDecimationFactor.
constexpr int kDfIncrement = 512;
constexpr int kDefaultBeatsPerBar = 4;

// Feed the mono signal to DownBeat in kDfIncrement blocks, zero-padding the
// tail, so its anti-aliasing decimator produces the downsampled buffer.
void PushDecimated(DownBeat& db, const float* mono, int num_frames) {
  std::vector<float> block(kDfIncrement);
  for (int off = 0; off < num_frames; off += kDfIncrement) {
    for (int i = 0; i < kDfIncrement; ++i) {
      const int idx = off + i;
      block[i] = idx < num_frames ? mono[idx] : 0.0f;
    }
    db.pushAudioBlock(block.data());
  }
}

// Beat seconds -> DownBeat's df-increment units: frame position / kDfIncrement.
std::vector<double>
BeatsToDfUnits(const std::vector<float>& beat_times, int sample_rate) {
  std::vector<double> beats;
  beats.reserve(beat_times.size());
  for (const float t : beat_times) {
    beats.push_back(
        static_cast<double>(t) * sample_rate / static_cast<double>(kDfIncrement)
    );
  }
  return beats;
}

}  // namespace

std::vector<int> FindDownbeats(
    const float* mono,
    int num_frames,
    int sample_rate,
    const std::vector<float>& beat_times,
    int beats_per_bar
) {
  std::vector<int> downbeats;
  if (mono == nullptr || num_frames <= 0 || sample_rate <= 0 ||
      beat_times.size() < 2) {
    return downbeats;
  }

  DownBeat db(static_cast<float>(sample_rate), kDecimationFactor, kDfIncrement);
  db.setBeatsPerBar(beats_per_bar > 0 ? beats_per_bar : kDefaultBeatsPerBar);

  PushDecimated(db, mono, num_frames);
  size_t ds_len = 0;
  const float* ds = db.getBufferedAudio(ds_len);

  const std::vector<double> beats = BeatsToDfUnits(beat_times, sample_rate);
  db.findDownBeats(ds, ds_len, beats, downbeats);
  return downbeats;
}

}  // namespace kitbag
