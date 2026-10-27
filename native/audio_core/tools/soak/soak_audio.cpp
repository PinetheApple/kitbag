#include "media/file_audio_reader.h"
#include "soak_cli.h"

namespace click_soak {

namespace {

constexpr uint64_t kChunkFrames = 4096;

// Device recordings run to hours, so the file is streamed in chunks rather
// than decoded whole: 4 h of 48 kHz stereo float is 5.5 GB.
template <typename Sink>
void ForEachMonoChunk(kitbag::FileAudioReader& reader, Sink sink) {
  const uint32_t channels = reader.channels();
  std::vector<float> interleaved(kChunkFrames * channels);
  std::vector<float> mono(kChunkFrames);
  for (;;) {
    const kitbag::ReadResult read =
        reader.ReadFrames(interleaved.data(), kChunkFrames);
    for (uint64_t frame = 0; frame < read.frames; ++frame) {
      float sum = 0.0F;
      for (uint32_t ch = 0; ch < channels; ++ch) {
        sum += interleaved[(frame * channels) + ch];
      }
      mono[frame] = sum / static_cast<float>(channels);
    }
    sink(mono.data(), static_cast<size_t>(read.frames));
    if (read.status != kitbag::ReadStatus::kOk) return;
  }
}

}  // namespace

ExitCode
OpenAudio(const std::string& path, AudioInfo* info, std::string* error) {
  kitbag::FileAudioReader reader;
  if (!reader.Open(path.c_str())) {
    *error = path + " is not a readable audio file (WAV, FLAC or MP3)";
    return ExitCode::kUnreadableAudio;
  }
  if (reader.total_frames() == 0 || reader.channels() == 0 ||
      reader.sample_rate() == 0) {
    *error = path + " decodes to no audio frames";
    return ExitCode::kUnreadableAudio;
  }
  info->sample_rate = reader.sample_rate();
  info->channels = reader.channels();
  info->frames = reader.total_frames();
  info->duration_sec = static_cast<double>(info->frames) /
                       static_cast<double>(info->sample_rate);
  return ExitCode::kPass;
}

ExitCode DetectFileOnsets(
    const std::string& path,
    double beat_sec,
    DetectionLevels* levels,
    std::vector<double>* onsets_sec
) {
  kitbag::FileAudioReader reader;
  if (!reader.Open(path.c_str())) return ExitCode::kUnreadableAudio;
  const uint32_t rate = reader.sample_rate();
  BlockPeakMeter meter(rate);
  ForEachMonoChunk(reader, [&meter](const float* mono, size_t count) {
    meter.Feed(mono, count);
  });
  const size_t block_frames = meter.block_frames();
  *levels = EstimateLevels(meter.Finish(), block_frames, rate, beat_sec);
  if (levels->click_peak <= 0.0) return ExitCode::kNoClicks;
  if (!reader.SeekToFrame(0)) return ExitCode::kUnreadableAudio;
  OnsetDetector detector(rate, *levels);
  ForEachMonoChunk(reader, [&detector](const float* mono, size_t count) {
    detector.Feed(mono, count);
  });
  *onsets_sec = detector.onsets_sec();
  return ExitCode::kPass;
}

}  // namespace click_soak
