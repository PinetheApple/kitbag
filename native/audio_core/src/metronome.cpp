#include "metronome.h"

#include <cmath>

namespace kitbag {

namespace {

constexpr double kTau = 6.283185307179586;
// Guards against a boundary landing infinitesimally below an integer.
constexpr double kGridEpsilon = 1e-9;

constexpr double kAccentAmplitude = 0.9;
constexpr double kBeatAmplitude = 0.6;
constexpr double kSubdivisionAmplitude = 0.3;
constexpr double kPolyAmplitude = 0.5;

struct SoundPreset {
  double accent_hz;
  double beat_hz;
  double subdivision_hz;
  double poly_hz;
  double decay_per_second;
};

constexpr SoundPreset kSounds[Metronome::kSoundCount] = {
    {1760.0, 1174.7, 880.0, 1480.0, 30.0},   // beep
    {2400.0, 1800.0, 1400.0, 2000.0, 60.0},  // woodblock
    {3600.0, 2800.0, 2200.0, 3200.0, 90.0},  // click
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

void Metronome::ApplyPendingCommands() {
  Command command;
  while (commands_.Pop(&command)) {
    switch (command.type) {
      case CommandType::kStart:
        beat_position_ = 0.0;
        running_ = true;
        break;
      case CommandType::kStop:
        running_ = false;
        current_beat_.store(-1, std::memory_order_relaxed);
        current_poly_beat_.store(-1, std::memory_order_relaxed);
        break;
      case CommandType::kSetTempo:
        bpm_ = Clamp(command.value, kMinBpm, kMaxBpm);
        break;
      case CommandType::kSetBeats:
        beats_per_bar_ = Clamp(command.int_a, 1, kMaxBeats);
        break;
      case CommandType::kSetSubdivision:
        subdivision_ = Clamp(command.int_a, 1, kMaxSubdivision);
        break;
      case CommandType::kSetAccent:
        if (command.int_a >= 0 && command.int_a < kMaxBeats) {
          accents_[command.int_a] = static_cast<Accent>(
              Clamp(command.int_b, 0, 2));
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
    }
  }
  running_flag_.store(running_, std::memory_order_relaxed);
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
  if (accent == Accent::kMuted) {
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
  if (accents_[owning_beat] == Accent::kMuted) {
    return;
  }
  const SoundPreset& sound = kSounds[sound_];
  TriggerClick(sound.subdivision_hz, kSubdivisionAmplitude,
               sound.decay_per_second, sample_rate);
}

void Metronome::OnPolyBoundary(int poly_index, uint32_t sample_rate) {
  current_poly_beat_.store(poly_index, std::memory_order_relaxed);
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
    if (voice.amplitude < 1e-4) {
      voice.active = false;
    }
  }
  return static_cast<float>(sample);
}

void Metronome::Render(float* output, uint32_t frame_count,
                       uint32_t sample_rate, uint32_t channel_count) {
  ApplyPendingCommands();

  const double beats_per_sample = bpm_ / (60.0 * sample_rate);
  const double poly_scale =
      static_cast<double>(poly_beats_) / static_cast<double>(beats_per_bar_);

  for (uint32_t frame = 0; frame < frame_count; ++frame) {
    if (running_) {
      const double position = beat_position_;
      const auto sub_index = static_cast<int64_t>(
          std::floor(position * subdivision_ + kGridEpsilon));
      const double sub_start =
          static_cast<double>(sub_index) / subdivision_;
      // A grid point fires on the first sample at or past it.
      if (position - beats_per_sample < sub_start - kGridEpsilon) {
        if (sub_index % subdivision_ == 0) {
          const auto beat_index = static_cast<int>(
              (sub_index / subdivision_) % beats_per_bar_);
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

    const float sample = RenderVoices();
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      output[frame * channel_count + channel] += sample;
    }
  }

  if (running_) {
    bar_phase_.store(
        std::fmod(beat_position_, static_cast<double>(beats_per_bar_)) /
            beats_per_bar_,
        std::memory_order_relaxed);
  }
}

}  // namespace kitbag
