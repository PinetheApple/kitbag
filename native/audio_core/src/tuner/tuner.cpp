// Mic lifecycle, the capture callback and the analysis thread. The app-thread
// setters and the command ring are in tuner_tuning.cpp.
#include "tuner/tuner.h"

#include <algorithm>
#include <chrono>
#include <cmath>

#include "tuner/tuning_rules.h"

namespace kitbag {

namespace {

constexpr double kSnapshotCentsLimit = 320.0;
constexpr double kSnapshotCentsScale = 100.0;
constexpr double kSnapshotConfidenceScale = 10000.0;
constexpr int kCentsShift = 16;
constexpr int kConfidenceShift = 32;

}  // namespace

uint64_t Tuner::PackSnapshot(const kb_tuner_state& state, double clarity) {
  int32_t note = -1;
  double cents = 0.0;
  if (state.can_hear_note != 0) {
    note = static_cast<int32_t>(std::lround(state.measured_midi));
    cents = (state.measured_midi - note) * tuning_rules::kCentsPerSemitone;
  }
  const auto packed_note = static_cast<uint16_t>(static_cast<int16_t>(note));
  const auto packed_cents =
      static_cast<uint16_t>(static_cast<int16_t>(std::lround(
          std::clamp(cents, -kSnapshotCentsLimit, kSnapshotCentsLimit) *
          kSnapshotCentsScale
      )));
  const auto packed_confidence = static_cast<uint16_t>(
      std::lround(std::clamp(clarity, 0.0, 1.0) * kSnapshotConfidenceScale)
  );
  return static_cast<uint64_t>(packed_note) |
         (static_cast<uint64_t>(packed_cents) << kCentsShift) |
         (static_cast<uint64_t>(packed_confidence) << kConfidenceShift);
}

Tuner::~Tuner() {
  Stop();
}

bool Tuner::OpenDevice() {
  ma_device_config config = ma_device_config_init(ma_device_type_capture);
  config.capture.format = ma_format_f32;
  config.capture.channels = 1;
  config.sampleRate = kSampleRate;
  config.dataCallback = DataCallback;
  config.pUserData = this;
  // Raw mic path: never AGC/NS/AEC on a tuner signal (SPEC.md §10.1). AAudio
  // honors this; other backends ignore the field.
  config.aaudio.inputPreset = ma_aaudio_input_preset_unprocessed;
  if (ma_device_init(nullptr, &config, &device_) != MA_SUCCESS) return false;
  if (ma_device_start(&device_) != MA_SUCCESS) {
    ma_device_uninit(&device_);
    return false;
  }
  device_ready_ = true;
  return true;
}

bool Tuner::Start() {
  if (is_running()) return true;
  ApplyCommands();
  if (!OpenDevice()) return false;
  // Ownership passes before the thread exists, so no app-thread setter can
  // apply directly once the thread could be reading tuning_mode_.
  analysis_owned_.store(true, std::memory_order_release);
  running_.store(true, std::memory_order_relaxed);
  analysis_thread_ = std::thread(&Tuner::AnalysisLoop, this);
  return true;
}

void Tuner::Stop() {
  if (!is_running()) return;
  running_.store(false, std::memory_order_relaxed);
  if (analysis_thread_.joinable()) analysis_thread_.join();
  analysis_owned_.store(false, std::memory_order_release);
  if (device_ready_) {
    ma_device_uninit(&device_);
    device_ready_ = false;
  }
  // Commands the thread never reached still apply; then no reading survives.
  ApplyCommands();
  tuning_mode_.ResetNotePresence(0.0);
  Publish();
}

void Tuner::DataCallback(
    ma_device* device,
    void* output,
    const void* input,
    ma_uint32 frame_count
) {
  (void)output;
  auto* tuner = static_cast<Tuner*>(device->pUserData);
  const auto* samples = static_cast<const float*>(input);
  for (ma_uint32 frame = 0; frame < frame_count; ++frame) {
    // Dropped samples on a full ring are fine: the analysis re-settles and
    // the callback must never block.
    tuner->samples_.Push(samples[frame]);
  }
}

size_t Tuner::FillBlock(DrainBlock* block) {
  size_t count = 0;
  while (count < block->size() && samples_.Pop(&(*block)[count])) ++count;
  return count;
}

// Returns false when the ring was already empty.
bool Tuner::DrainAndAnalyze() {
  DrainBlock block{};
  bool drained_any = false;
  for (size_t count = FillBlock(&block); count > 0; count = FillBlock(&block)) {
    drained_any = true;
    Analyse(block.data(), static_cast<uint32_t>(count));
  }
  return drained_any;
}

void Tuner::AnalysisLoop() {
  tuning_mode_.Init(kSampleRate);
  Publish();
  while (running_.load(std::memory_order_relaxed)) {
    ApplyCommands();
    if (!DrainAndAnalyze()) {
      std::this_thread::sleep_for(std::chrono::microseconds(kIdleSleepMicros));
    }
  }
}

void Tuner::Analyse(const float* samples, uint32_t frame_count) {
  tuning_mode_.Process(samples, frame_count);
  Publish();
}

void Tuner::Publish() {
  const kb_tuner_state& state = tuning_mode_.state();
  state_mirror_.Store(state);
  snapshot_.store(
      PackSnapshot(state, tuning_mode_.clarity()),
      std::memory_order_relaxed
  );
}

}  // namespace kitbag
