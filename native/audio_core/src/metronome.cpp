#include "metronome.h"

#include <cmath>

namespace kitbag {

namespace {

constexpr double kTau = 6.283185307179586;
// Guards against a boundary landing infinitesimally below an integer.
constexpr double kGridEpsilon = 1e-9;

constexpr double kSecondsPerMinute = 60.0;
constexpr double kMsPerMinute = 60000.0;

constexpr double kAccentAmplitude = 0.9;
constexpr double kBeatAmplitude = 0.6;
constexpr double kSubdivisionAmplitude = 0.3;
constexpr double kPolyAmplitude = 0.5;
// A decaying voice is retired once it falls below audibility.
constexpr double kVoiceSilenceAmplitude = 1e-4;

struct SoundPreset {
  double accent_hz;
  double beat_hz;
  double subdivision_hz;
  double poly_hz;
  double decay_per_second;
};

constexpr SoundPreset kSounds[Metronome::kSoundCount] = {
    {1760.0, 1174.7, 880.0, 1480.0, 30.0},    // beep
    {2400.0, 1800.0, 1400.0, 2000.0, 60.0},   // woodblock
    {3600.0, 2800.0, 2200.0, 3200.0, 90.0},   // click
    {600.0, 450.0, 300.0, 520.0, 60.0},       // tom
    {5000.0, 4000.0, 3500.0, 4500.0, 120.0},  // hihat
    {2200.0, 1500.0, 1400.0, 1800.0, 45.0},   // cowbell
};

template <typename T>
T Clamp(T value, T low, T high) {
  return value < low ? low : (value > high ? high : value);
}

}  // namespace

void Metronome::Start() { commands_.Push({CommandType::kStart}); }

void Metronome::Stop() { commands_.Push({CommandType::kStop}); }

void Metronome::SetTempo(double bpm) {
  Command command{CommandType::kSetTempo};
  command.value = bpm;
  commands_.Push(command);
}

void Metronome::SetBeatsPerBar(int beats) {
  Command command{CommandType::kSetBeats};
  command.int_a = beats;
  commands_.Push(command);
}

void Metronome::SetSubdivision(int subdivision) {
  Command command{CommandType::kSetSubdivision};
  command.int_a = subdivision;
  commands_.Push(command);
}

void Metronome::SetAccent(int beat_index, Accent accent) {
  Command command{CommandType::kSetAccent};
  command.int_a = beat_index;
  command.int_b = static_cast<int32_t>(accent);
  commands_.Push(command);
}

void Metronome::SetPolyrhythm(bool enabled, int beats) {
  Command command{CommandType::kSetPoly};
  command.int_a = enabled ? 1 : 0;
  command.int_b = beats;
  commands_.Push(command);
}

void Metronome::SetSound(int sound_index) {
  Command command{CommandType::kSetSound};
  command.int_a = sound_index;
  commands_.Push(command);
}

void Metronome::SetVolume(double volume) {
  Command command{CommandType::kSetVolume};
  command.value = volume;
  commands_.Push(command);
}

void Metronome::SetLatencyOffset(double latency_ms) {
  Command command{CommandType::kSetLatencyOffset};
  command.value = latency_ms;
  commands_.Push(command);
}

void Metronome::SetRamp(bool enabled, double start_bpm, double end_bpm,
                        int bars) {
  Command command{CommandType::kSetRamp};
  command.value = start_bpm;
  command.value_b = end_bpm;
  command.int_a = enabled ? 1 : 0;
  command.int_b = bars;
  commands_.Push(command);
}

void Metronome::SetBarMute(bool enabled, int play_bars, int mute_bars) {
  Command command{CommandType::kSetBarMute};
  command.int_a = enabled ? 1 : 0;
  command.int_b = play_bars;
  command.int_c = mute_bars;
  commands_.Push(command);
}

void Metronome::ApplyPendingCommands() {
  Command command;
  while (commands_.Pop(&command)) {
    switch (command.type) {
      case CommandType::kStart:
        current_bar_ = -1;  // the first downbeat advances it to bar 0
        ramp_start_bar_ = 0;
        if (ramp_enabled_) {
          bpm_ = ramp_start_bpm_;
        }
        // Anchors `position` at zero, not beat_position_: nothing can be
        // emitted before the first frame, so a positive offset would swallow
        // every grid point it shifts past.
        beat_position_ = -LatencyBeats();
        running_ = true;
        break;
      case CommandType::kStop:
        running_ = false;
        current_beat_.store(-1, std::memory_order_relaxed);
        current_poly_beat_.store(-1, std::memory_order_relaxed);
        break;
      case CommandType::kSetTempo:
        SetBpmPreservingPhase(Clamp(command.value, kMinBpm, kMaxBpm));
        ramp_enabled_ = false;  // a manual tempo change cancels the ramp
        break;
      case CommandType::kSetBeats:
        beats_per_bar_ = Clamp(command.int_a, 1, kMaxBeats);
        break;
      case CommandType::kSetSubdivision:
        subdivision_ = Clamp(command.int_a, 1, kMaxSubdivision);
        break;
      case CommandType::kSetAccent:
        if (command.int_a >= 0 && command.int_a < kMaxBeats) {
          accents_[command.int_a] =
              static_cast<Accent>(Clamp(command.int_b, 0, 2));
        }
        break;
      case CommandType::kSetPoly:
        poly_enabled_ = command.int_a != 0;
        poly_beats_ = Clamp(command.int_b, 2, kMaxPolyBeats);
        if (!poly_enabled_) {
          current_poly_beat_.store(-1, std::memory_order_relaxed);
        }
        break;
      case CommandType::kSetSound:
        sound_ = Clamp(command.int_a, 0, kSoundCount - 1);
        break;
      case CommandType::kSetRamp:
        ramp_enabled_ = command.int_a != 0;
        if (ramp_enabled_) {
          ramp_start_bpm_ = Clamp(command.value, kMinBpm, kMaxBpm);
          ramp_end_bpm_ = Clamp(command.value_b, kMinBpm, kMaxBpm);
          ramp_bars_ = Clamp(command.int_b, 1, kMaxRampBars);
          // current_bar_ is -1 before the first downbeat; never start there.
          ramp_start_bar_ = running_ && current_bar_ > 0 ? current_bar_ : 0;
          SetBpmPreservingPhase(ramp_start_bpm_);
        }
        break;
      case CommandType::kSetBarMute:
        mute_enabled_ = command.int_a != 0;
        play_bars_ = Clamp(command.int_b, 1, kMaxMuteBars);
        mute_bars_ = Clamp(command.int_c, 1, kMaxMuteBars);
        break;
      case CommandType::kSetVolume:
        volume_ = Clamp(command.value, 0.0, 2.0);
        break;
      case CommandType::kSetLatencyOffset: {
        // Phase-preserving like a bpm change (§4.6). The guard: when stopped
        // there is no phase to hold, and kStart re-anchors from the offset.
        const double before = LatencyBeats();
        latency_offset_ms_ =
            Clamp(command.value, -kMaxLatencyOffsetMs, kMaxLatencyOffsetMs);
        if (running_) {
          beat_position_ += before - LatencyBeats();
        }
        break;
      }
    }
  }
  running_flag_.store(running_, std::memory_order_relaxed);
}

double Metronome::LatencyBeats() const {
  return latency_offset_ms_ * bpm_ / kMsPerMinute;
}

// The offset is fixed in ms, so its width in beats rescales with the tempo.
// Assigning bpm_ directly would step `position` sideways: ramping down
// re-crosses the grid point that just fired, ramping up jumps over the next.
void Metronome::SetBpmPreservingPhase(double new_bpm) {
  const double before = LatencyBeats();
  bpm_ = new_bpm;
  beat_position_ += before - LatencyBeats();
}

double Metronome::RampBpmForBar(int64_t bar) const {
  const int64_t progressed =
      Clamp<int64_t>(bar - ramp_start_bar_, 0, ramp_bars_);
  const double step = (ramp_end_bpm_ - ramp_start_bpm_) / ramp_bars_;
  return ramp_start_bpm_ + step * static_cast<double>(progressed);
}

bool Metronome::BarIsMuted(int64_t bar) const {
  if (!mute_enabled_) {
    return false;
  }
  return bar % (play_bars_ + mute_bars_) >= play_bars_;
}

void Metronome::TriggerClick(double frequency_hz, double amplitude,
                             double decay_per_second, uint32_t sample_rate) {
  Voice* slot = nullptr;
  for (Voice& voice : voices_) {
    if (!voice.active) {
      slot = &voice;
      break;
    }
  }
  if (slot == nullptr) {
    slot = &voices_[0];
    for (Voice& voice : voices_) {
      if (voice.amplitude < slot->amplitude) {
        slot = &voice;
      }
    }
  }
  slot->active = true;
  slot->phase = 0.0;
  slot->phase_step = kTau * frequency_hz / sample_rate;
  slot->amplitude = amplitude;
  slot->decay_per_sample =
      std::exp(-decay_per_second / static_cast<double>(sample_rate));
}

void Metronome::OnBeatBoundary(int beat_index, uint32_t sample_rate) {
  current_beat_.store(beat_index, std::memory_order_relaxed);
  const Accent accent =
      beat_index < kMaxBeats ? accents_[beat_index] : Accent::kNormal;
  if (accent == Accent::kMuted || BarIsMuted(current_bar_)) {
    return;
  }
  const SoundPreset& sound = kSounds[sound_];
  const bool accented = accent == Accent::kAccented;
  TriggerClick(accented ? sound.accent_hz : sound.beat_hz,
               accented ? kAccentAmplitude : kBeatAmplitude,
               sound.decay_per_second, sample_rate);
}

void Metronome::OnSubdivisionTick(uint32_t sample_rate) {
  const int owning_beat =
      static_cast<int>(std::floor(beat_position_ + kGridEpsilon)) %
      beats_per_bar_;
  if (accents_[owning_beat] == Accent::kMuted || BarIsMuted(current_bar_)) {
    return;
  }
  const SoundPreset& sound = kSounds[sound_];
  TriggerClick(sound.subdivision_hz, kSubdivisionAmplitude,
               sound.decay_per_second, sample_rate);
}

void Metronome::OnPolyBoundary(int poly_index, uint32_t sample_rate) {
  current_poly_beat_.store(poly_index, std::memory_order_relaxed);
  // Muted bars silence the poly voice too: the trainer's point is keeping
  // time internally, so nothing may sound during a muted bar.
  if (BarIsMuted(current_bar_)) {
    return;
  }
  const SoundPreset& sound = kSounds[sound_];
  TriggerClick(sound.poly_hz, kPolyAmplitude, sound.decay_per_second,
               sample_rate);
}

float Metronome::RenderVoices() {
  double sample = 0.0;
  for (Voice& voice : voices_) {
    if (!voice.active) {
      continue;
    }
    sample += voice.amplitude * std::sin(voice.phase);
    voice.phase += voice.phase_step;
    voice.amplitude *= voice.decay_per_sample;
    if (voice.amplitude < kVoiceSilenceAmplitude) {
      voice.active = false;
    }
  }
  return static_cast<float>(sample);
}

void Metronome::Render(float* output, uint32_t frame_count,
                       uint32_t sample_rate, uint32_t channel_count) {
  ApplyPendingCommands();

  double beats_per_sample = bpm_ / (kSecondsPerMinute * sample_rate);
  const double poly_scale =
      static_cast<double>(poly_beats_) / static_cast<double>(beats_per_bar_);

  double latency_beats = LatencyBeats();

  for (uint32_t frame = 0; frame < frame_count; ++frame) {
    if (running_) {
      const double position = beat_position_ + latency_beats;
      const auto sub_index = static_cast<int64_t>(
          std::floor(position * subdivision_ + kGridEpsilon));
      const double sub_start = static_cast<double>(sub_index) / subdivision_;
      // A grid point fires on the first sample at or past it.
      if (position - beats_per_sample < sub_start - kGridEpsilon) {
        if (sub_index % subdivision_ == 0) {
          const int64_t beat = sub_index / subdivision_;
          const auto beat_index = static_cast<int>(beat % beats_per_bar_);
          if (beat_index == 0) {
            ++current_bar_;  // monotonic: survives time-signature changes
            if (ramp_enabled_) {
              SetBpmPreservingPhase(RampBpmForBar(current_bar_));
              beats_per_sample = bpm_ / (kSecondsPerMinute * sample_rate);
              latency_beats = LatencyBeats();
            }
          }
          OnBeatBoundary(beat_index, sample_rate);
        } else if (subdivision_ > 1) {
          OnSubdivisionTick(sample_rate);
        }
      }
      if (poly_enabled_) {
        const auto poly_index = static_cast<int64_t>(
            std::floor(position * poly_scale + kGridEpsilon));
        const double poly_start = static_cast<double>(poly_index) / poly_scale;
        if (position - beats_per_sample < poly_start - kGridEpsilon) {
          OnPolyBoundary(static_cast<int>(poly_index % poly_beats_),
                         sample_rate);
        }
      }
      beat_position_ += beats_per_sample;
    }

    const float sample = RenderVoices() * volume_;
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      output[frame * channel_count + channel] += sample;
    }
  }

  if (running_) {
    // Track `position`, not beat_position_, so the sweep, the LED
    // (current_beat_) and the audible click share one time base (§13.3). How
    // that base relates to real output latency is §4.2's phase-anchor decision.
    const double position = beat_position_ + LatencyBeats();
    bar_phase_.store(std::fmod(position, static_cast<double>(beats_per_bar_)) /
                         beats_per_bar_,
                     std::memory_order_relaxed);
  }
  current_bpm_.store(bpm_, std::memory_order_relaxed);
  bar_muted_flag_.store(running_ && BarIsMuted(current_bar_),
                        std::memory_order_relaxed);
}

}  // namespace kitbag
