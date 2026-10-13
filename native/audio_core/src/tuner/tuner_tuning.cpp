// The tuner's app-thread setters and the command ring that carries them to the
// analysis thread.
#include <algorithm>

#include "tuner/tuner.h"

namespace kitbag {

kb_result Tuner::SetA4(double a4_hz) {
  TuningCommand command;
  command.kind = TuningCommand::Kind::kSetA4;
  command.value = a4_hz;
  return SendCommand(command);
}

kb_result Tuner::SetBand(double low_hz, double high_hz) {
  if (!(low_hz > 0.0 && high_hz > low_hz)) return KB_ERROR_INVALID_ARGUMENT;
  TuningCommand command;
  command.kind = TuningCommand::Kind::kSetBand;
  command.value = low_hz;
  command.high = high_hz;
  return SendCommand(command);
}

kb_result Tuner::SetTuning(
    int32_t instrument,
    const int32_t* string_midis,
    int32_t count
) {
  if (!TuningMode::ValidTuning(instrument, string_midis, count)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  TuningCommand command;
  command.kind = TuningCommand::Kind::kSetTuning;
  command.instrument = instrument;
  command.count = count;
  std::copy(string_midis, string_midis + count, command.midis.begin());
  const kb_result result = SendCommand(command);
  if (result == KB_OK) app_string_count_ = count;
  return result;
}

kb_result Tuner::SetTargetString(int32_t string_index) {
  const bool valid = string_index == KB_TUNER_AUTO_STRING ||
                     (string_index >= 0 && string_index < app_string_count_);
  if (!valid) return KB_ERROR_INVALID_ARGUMENT;
  TuningCommand command;
  command.kind = TuningCommand::Kind::kSetTarget;
  command.target = string_index;
  return SendCommand(command);
}

kb_result Tuner::SetChromatic() {
  TuningCommand command;
  command.kind = TuningCommand::Kind::kSetChromatic;
  return SendCommand(command);
}

kb_result Tuner::ResetNotePresence(double pause_ms) {
  TuningCommand command;
  command.kind = TuningCommand::Kind::kReset;
  command.value = pause_ms;
  return SendCommand(command);
}

bool Tuner::OfflineInit(uint32_t sample_rate) {
  if (is_running() || sample_rate == 0) return false;
  ApplyCommands();
  tuning_mode_.Init(sample_rate);
  Publish();
  return true;
}

void Tuner::OfflineProcess(const float* samples, uint32_t frame_count) {
  if (is_running()) return;
  ApplyCommands();
  Analyse(samples, frame_count);
}

// With the mic off the app thread owns tuning_mode_ and drains the ring
// itself, so the command applies before this returns.
kb_result Tuner::SendCommand(const TuningCommand& command) {
  if (!commands_.Push(command)) return KB_ERROR_BUSY;
  if (!is_running()) ApplyCommands();
  return KB_OK;
}

void Tuner::ApplyCommands() {
  TuningCommand command;
  bool applied = false;
  while (commands_.Pop(&command)) {
    ApplyCommand(command);
    applied = true;
  }
  if (applied) Publish();
}

void Tuner::ApplyCommand(const TuningCommand& command) {
  using Kind = TuningCommand::Kind;
  switch (command.kind) {
    case Kind::kSetTuning:
      tuning_mode_
          .SetTuning(command.instrument, command.midis.data(), command.count);
      return;
    case Kind::kSetTarget:
      tuning_mode_.SetTargetString(command.target);
      return;
    case Kind::kSetChromatic:
      tuning_mode_.SetChromatic();
      return;
    case Kind::kSetBand:
      tuning_mode_.SetChromaticBand(command.value, command.high);
      return;
    case Kind::kSetA4:
      tuning_mode_.SetA4(command.value);
      return;
    case Kind::kReset:
      tuning_mode_.ResetNotePresence(command.value);
      return;
  }
}

}  // namespace kitbag
