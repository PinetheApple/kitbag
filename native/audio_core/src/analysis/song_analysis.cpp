// The offline analysis pipeline behind kb_analyze_song. App thread only —
// nothing here runs on the audio callback, so it may allocate.
#include "analysis/song_analysis.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "analysis/downbeat.h"
#include "analysis/onset_envelope.h"
#include "analysis/sidecar_path.h"
#include "analysis/waveform_peaks.h"
#include "media/audio_source.h"

namespace kitbag {

namespace {

constexpr uint64_t kAnalysisChunkFrames = 4096;

bool AllFinite(const float* pcm, size_t count) {
  for (size_t i = 0; i < count; ++i) {
    if (!std::isfinite(pcm[i])) return false;
  }
  return true;
}

class ChunkStream {
 public:
  explicit ChunkStream(SourceReader& reader)
      : reader_(reader),
        channels_(reader.channels()),
        interleaved_(kAnalysisChunkFrames * channels_),
        mono_(kAnalysisChunkFrames) {}

  size_t Next() {
    if (ended_) return 0;
    const ReadResult read =
        reader_.ReadFrames(interleaved_.data(), kAnalysisChunkFrames);
    ended_ = read.status != ReadStatus::kOk;
    const auto frames = static_cast<size_t>(read.frames);
    for (size_t f = 0; f < frames; ++f) {
      float sum = 0.0f;
      for (uint32_t ch = 0; ch < channels_; ++ch) {
        sum += interleaved_[f * channels_ + ch];
      }
      mono_[f] = sum / static_cast<float>(channels_);
    }
    return frames;
  }

  const float* interleaved() const {
    return interleaved_.data();
  }
  const float* mono() const {
    return mono_.data();
  }

 private:
  SourceReader& reader_;
  uint32_t channels_;
  std::vector<float> interleaved_;
  std::vector<float> mono_;
  bool ended_ = false;
};

struct FirstPass {
  std::vector<float> flux;
  uint64_t frames = 0;
};

kb_result ReadFirstPass(SourceReader& reader, FirstPass* out) {
  OnsetEnvelope onset;
  ChunkStream chunks(reader);
  for (size_t n = chunks.Next(); n > 0; n = chunks.Next()) {
    if (!AllFinite(chunks.interleaved(), n * reader.channels())) {
      return KB_ERROR_INVALID_ARGUMENT;
    }
    out->frames += n;
    if (!WithinFrameCap(out->frames)) return KB_ERROR_INVALID_ARGUMENT;
    onset.Push(chunks.mono(), n);
  }
  out->flux = onset.TakeFlux();
  return KB_OK;
}

struct SecondPass {
  std::unique_ptr<DownbeatTracker> downbeats;
  std::unique_ptr<WaveformPeakAccumulator> peaks;
};

SecondPass PlanSecondPass(
    const BeatResult& beats,
    uint64_t frames,
    int channels,
    int rate,
    const char* waveform_dir
) {
  SecondPass pass;
  if (beats.beat_times.size() >= 2) {
    pass.downbeats =
        std::make_unique<DownbeatTracker>(rate, beats.beat_times, frames, 0);
  }
  if (waveform_dir != nullptr) {
    pass.peaks = std::make_unique<WaveformPeakAccumulator>(
        static_cast<int64_t>(frames),
        channels,
        kWaveformTargetChunks
    );
  }
  return pass;
}

kb_result ReadSecondPass(
    SourceReader& reader,
    uint64_t expected_frames,
    SecondPass* pass
) {
  if (!reader.SeekToFrame(0)) return KB_ERROR_INTERNAL;
  ChunkStream chunks(reader);
  uint64_t frames = 0;
  for (size_t n = chunks.Next(); n > 0; n = chunks.Next()) {
    frames += n;
    if (pass->downbeats != nullptr) pass->downbeats->Push(chunks.mono(), n);
    if (pass->peaks != nullptr) pass->peaks->Push(chunks.interleaved(), n);
  }
  return frames == expected_frames ? KB_OK : KB_ERROR_INTERNAL;
}

// Layout: magic "KWAV" (4 bytes), version(uint32), channels(uint32),
// total_frames(int64), chunk_count(uint32), data(int16[]).
void WritePeaks(std::FILE* f, const WaveformPeaks& peaks) {
  const uint32_t version = 1;
  const auto channels_u32 = static_cast<uint32_t>(peaks.channels);
  const int64_t total = peaks.total_frames;
  const auto chunks = static_cast<uint32_t>(peaks.chunk_count);
  std::fwrite("KWAV", 1, 4, f);
  std::fwrite(&version, sizeof(version), 1, f);
  std::fwrite(&channels_u32, sizeof(channels_u32), 1, f);
  std::fwrite(&total, sizeof(total), 1, f);
  std::fwrite(&chunks, sizeof(chunks), 1, f);
  std::fwrite(peaks.data.data(), sizeof(int16_t), peaks.data.size(), f);
}

void WriteWaveformSidecar(
    const char* path,
    const char* waveform_dir,
    const WaveformPeaks& peaks
) {
  if (peaks.data.empty()) return;
  const std::string kwav_path = SidecarPath(waveform_dir, path);
  std::FILE* f = std::fopen(kwav_path.c_str(), "wb");
  if (f == nullptr) return;
  WritePeaks(f, peaks);
  std::fclose(f);
}

}  // namespace

bool WithinFrameCap(uint64_t frames) {
  return frames <= kMaxAnalysisFrames;
}

kb_result AnalyzeSong(
    SourceReader& reader,
    const char* path,
    const char* waveform_dir,
    BeatResult* out
) {
  const uint32_t reader_channels = reader.channels();
  if (reader_channels == 0 ||
      reader_channels >
          static_cast<uint32_t>(std::numeric_limits<int>::max())) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  const auto channels = static_cast<int>(reader_channels);
  FirstPass first;
  const kb_result scanned = ReadFirstPass(reader, &first);
  if (scanned != KB_OK || first.frames == 0) return scanned;

  const int rate = static_cast<int>(reader.sample_rate());
  *out = BeatTracker().AnalyzeFlux(std::move(first.flux), rate);
  SecondPass second =
      PlanSecondPass(*out, first.frames, channels, rate, waveform_dir);
  if (second.downbeats == nullptr && second.peaks == nullptr) return KB_OK;

  const kb_result rescanned = ReadSecondPass(reader, first.frames, &second);
  if (rescanned != KB_OK) return rescanned;
  if (second.downbeats != nullptr) {
    out->downbeat_indices = second.downbeats->Finish();
  }
  if (second.peaks != nullptr) {
    WriteWaveformSidecar(path, waveform_dir, second.peaks->peaks());
  }
  return KB_OK;
}

}  // namespace kitbag
