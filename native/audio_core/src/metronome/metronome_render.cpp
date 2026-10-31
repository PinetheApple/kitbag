// The audio callback: voice synthesis and the per-sample sequencer loop.
// Allocation-free, lock-free, no syscalls (SPEC.md §4.5).
#include <cmath>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

namespace {

using metronome_detail::BarFraction;
using metronome_detail::Clamp;
using metronome_detail::kAccentAmplitude;
using metronome_detail::kBeatAmplitude;
using metronome_detail::kGridEpsilon;
using metronome_detail::kSecondsPerMinute;

constexpr double kTau = 6.283185307179586;

constexpr double kSubdivisionAmplitude = 0.3;
constexpr double kPolyBeatAmplitude = 0.5;
constexpr double kPolyAccentAmplitude = 0.8;
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

int64_t TickIndex(double position, double ticks_per_beat) {
  return static_cast<int64_t>(
      std::floor(position * ticks_per_beat + kGridEpsilon)
  );
}

bool CrossesTick(double previous, double position, double ticks_per_beat) {
  return TickIndex(previous, ticks_per_beat) <
         TickIndex(position, ticks_per_beat);
}

}  // namespace

void Metronome::TriggerClick(
    double frequency_hz,
    double amplitude,
    double decay_per_second,
    uint32_t sample_rate
) {
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

void Metronome::TriggerPreset(int sound, bool accented, uint32_t sample_rate) {
  const SoundPreset& preset = kSounds[sound];
  TriggerClick(
      accented ? preset.accent_hz : preset.beat_hz,
      accented ? kAccentAmplitude : kBeatAmplitude,
      preset.decay_per_second,
      sample_rate
  );
}

void Metronome::OnBeatBoundary(int beat_index, uint32_t sample_rate) {
  current_beat_.store(beat_index, std::memory_order_relaxed);
  const Accent accent = beat_index >= 0 && beat_index < kMaxBeats
                            ? accents_[beat_index]
                            : Accent::kNormal;
  if (accent == Accent::kMuted || BarIsMuted(current_bar_)) return;
  const bool accented = accent == Accent::kAccented;
  TriggerPreset(
      accented ? accent_sound_ : normal_sound_,
      accented,
      sample_rate
  );
}

void Metronome::OnSubdivisionTick(int64_t speaker_beat, uint32_t sample_rate) {
  // Mutes with its own speaker-time beat (#21).
  const int beat_in_bar = static_cast<int>(speaker_beat % beats_per_bar_);
  if (accents_[beat_in_bar] == Accent::kMuted || BarIsMuted(current_bar_)) {
    return;
  }
  const SoundPreset& sound = kSounds[normal_sound_];
  TriggerClick(
      sound.subdivision_hz,
      kSubdivisionAmplitude,
      sound.decay_per_second,
      sample_rate
  );
}

void Metronome::OnPolyBoundary(int poly_index, uint32_t sample_rate) {
  current_poly_beat_.store(poly_index, std::memory_order_relaxed);
  const Accent accent = poly_accents_[poly_index];
  if (accent == Accent::kMuted || BarIsMuted(current_bar_)) return;
  const bool accented = accent == Accent::kAccented;
  const SoundPreset& sound = kSounds[accented ? accent_sound_ : normal_sound_];
  TriggerClick(
      sound.poly_hz,
      accented ? kPolyAccentAmplitude : kPolyBeatAmplitude,
      sound.decay_per_second,
      sample_rate
  );
}

float Metronome::RenderVoices() {
  double sample = 0.0;
  for (Voice& voice : voices_) {
    if (!voice.active) continue;
    sample += voice.amplitude * std::sin(voice.phase);
    voice.phase += voice.phase_step;
    voice.amplitude *= voice.decay_per_sample;
    if (voice.amplitude < kVoiceSilenceAmplitude) {
      voice.active = false;
    }
  }
  return static_cast<float>(sample);
}

Metronome::BlockTempo Metronome::BlockTempoFor(uint32_t sample_rate) const {
  BlockTempo tempo;
  tempo.beats_per_sample =
      bpm_ * BeatUnitScale() / (kSecondsPerMinute * sample_rate);
  tempo.latency_beats = LatencyBeats();
  tempo.poly_ticks_per_beat = static_cast<double>(poly_beats_) /
                              static_cast<double>(EffectivePolyAgainst());
  return tempo;
}

Metronome::GridView
Metronome::AcquireGrid(uint64_t block_start_frame, uint32_t sample_rate) {
  // One acquire load per block. Change is detected by generation, never by
  // address: a freed grid's address can be recycled, a generation cannot.
  const auto* node = grid_.Get();
  GridView view;
  if (node != nullptr && !node->value.beat_times_sec.empty()) {
    view.grid = &node->value;
    view.generation = node->generation;
  }
  if (view.generation != observed_generation_) {
    // Changed, cleared, or the run just started or stopped: re-seed from where
    // the click is now, so beats that already fired are never revisited.
    observed_generation_ = view.generation;
    follow_next_frame_ = kReseedFollow;
    if (view.grid != nullptr && !follow_mixer_) {
      SeekGridCursor(
          *view.grid,
          GridSeconds(*view.grid, block_start_frame, sample_rate)
      );
    }
  }
  return view;
}

void Metronome::BeginPendingStart(
    const GridView& view,
    uint64_t frame,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  // BeginRun may change bpm_ (an armed ramp resets it to its start), so the
  // block's tempo derivatives must be recomputed against the new value.
  BeginRun();
  has_pending_start_ = false;
  *tempo = BlockTempoFor(sample_rate);
  follow_next_frame_ = kReseedFollow;
  if (view.grid == nullptr || follow_mixer_) return;
  // Seed at the anchor: the top-of-block re-seed already ran, and a cursor left
  // at the block start swallows every beat up to the anchor into one click.
  SeekGridCursor(*view.grid, GridSeconds(*view.grid, frame, sample_rate));
  observed_generation_ = view.generation;
}

int64_t Metronome::LastSoundedBeat(double beats_per_sample) const {
  return TickIndex(beat_position_ + LatencyBeats() - beats_per_sample, 1.0);
}

void Metronome::SyncBarFromPosition(double beats_per_sample) {
  const int64_t last_beat = LastSoundedBeat(beats_per_sample);
  current_bar_ = last_beat < 0 ? -1 : last_beat / beats_per_bar_;
}

void Metronome::BeginAnchorExternal(
    uint64_t now,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  has_pending_anchor_ = false;
  has_pending_start_ = false;  // an anchor supersedes a deferred start
  ramp_.Disable();
  bpm_ = Clamp(pending_anchor_bpm_, kMinBpm, kMaxBpm);
  const double song_seconds =
      pending_anchor_song_pos_ +
      (static_cast<double>(now) - static_cast<double>(pending_anchor_frame_)) /
          sample_rate;
  // position == song beats, so beat_position_ carries no latency term; the
  // per-sample bias in AdvanceConstantTempo adds it back (§4.7).
  // Song second → this signature's beat unit, so an 8th-note bar anchors on the
  // song's clock like a quarter-note one.
  beat_position_ = song_seconds * bpm_ * BeatUnitScale() / kSecondsPerMinute;
  running_ = true;
  running_flag_.store(true, std::memory_order_relaxed);
  counting_in_ = false;
  count_in_armed_ = false;
  ReacquireGrid();
  *tempo = BlockTempoFor(sample_rate);
  SyncBarFromPosition(tempo->beats_per_sample);
}

void Metronome::FireConstantTempoTick(
    int64_t sub_index,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  // sub_index is on the speaker-time base and never negative here.
  const int64_t beat = sub_index / subdivision_;
  if (sub_index % subdivision_ != 0) {
    if (subdivision_ > 1) OnSubdivisionTick(beat, sample_rate);
    return;
  }
  const auto beat_index = static_cast<int>(beat % beats_per_bar_);
  if (beat_index == 0) {
    ++current_bar_;  // monotonic: survives time-signature changes
  }
  if (ramp_.enabled()) {
    const double next =
        ramp_.TempoAtBeat(beat_index == 0, current_bar_, sample_rate);
    if (next != bpm_) {
      SetBpmPreservingPhase(next);
      *tempo = BlockTempoFor(sample_rate);
    }
  }
  OnBeatBoundary(beat_index, sample_rate);
}

void Metronome::AdvanceConstantTempo(uint32_t sample_rate, BlockTempo* tempo) {
  double position = beat_position_ + tempo->latency_beats;
  if (counting_in_) position = AdvanceCountIn(position, *tempo, sample_rate);
  if (position >= -kGridEpsilon) {
    // Read before FireConstantTempoTick: a ramp step there rewrites
    // tempo->beats_per_sample.
    const double previous = position - tempo->beats_per_sample;
    if (CrossesTick(previous, position, subdivision_)) {
      FireConstantTempoTick(
          TickIndex(position, subdivision_),
          sample_rate,
          tempo
      );
    }
    const double poly_ticks = tempo->poly_ticks_per_beat;
    if (poly_enabled_ && CrossesTick(previous, position, poly_ticks)) {
      const int64_t poly_index = TickIndex(position, poly_ticks);
      OnPolyBoundary(static_cast<int>(poly_index % poly_beats_), sample_rate);
    }
    ramp_.AdvanceFrame();
  }
  beat_position_ += tempo->beats_per_sample;
}

void Metronome::PublishBlockMirrors(
    const BeatGrid* grid,
    uint64_t frame,
    uint32_t sample_rate
) {
  if (!running_) {
    current_bpm_.store(bpm_, std::memory_order_relaxed);
  } else if (grid != nullptr) {
    PublishGridMirrors(
        *grid,
        follow_mixer_ ? follow_seconds_ : GridSeconds(*grid, frame, sample_rate)
    );
    current_poly_beat_.store(-1, std::memory_order_relaxed);
  } else {
    // Track `position`, not beat_position_, so the sweep, the LED and the
    // audible click share one time base (§4.5); the mapping to real latency
    // is §4.2's phase-anchor decision.
    const double position = beat_position_ + LatencyBeats();
    bar_phase_.store(
        BarFraction(position, beats_per_bar_),
        std::memory_order_relaxed
    );
    current_bpm_.store(bpm_, std::memory_order_relaxed);
  }
  poly_downbeat_phase_.store(
      PolyDownbeatPhase(
          grid != nullptr,
          BlockTempoFor(sample_rate).beats_per_sample
      ),
      std::memory_order_relaxed
  );
  PublishTrainerMirrors(grid != nullptr, sample_rate);
}

Metronome::GridView Metronome::BeginBlock(
    uint64_t block_start_frame,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  ApplyPendingCommands();
  if (pending_preview_sound_ >= 0) {
    TriggerPreset(
        pending_preview_sound_,
        pending_preview_accented_,
        sample_rate
    );
    pending_preview_sound_ = -1;
  }
  *tempo = BlockTempoFor(sample_rate);
  const GridView view = AcquireGrid(block_start_frame, sample_rate);
  // Applied at block start, before any click this block: a re-anchor moves only
  // future targets, never one already emitted (§4.2).
  if (has_pending_anchor_) {
    BeginAnchorExternal(block_start_frame, sample_rate, tempo);
  }
  return view;
}

void Metronome::Render(
    float* output,
    uint32_t frame_count,
    uint32_t sample_rate,
    uint32_t channel_count,
    uint64_t block_start_frame,
    const SongClock* song
) {
  BlockTempo tempo{};
  const GridView view = BeginBlock(block_start_frame, sample_rate, &tempo);

  for (uint32_t frame = 0; frame < frame_count; ++frame) {
    const uint64_t now = block_start_frame + frame;
    if (has_pending_start_ && now >= pending_start_frame_) {
      BeginPendingStart(view, now, sample_rate, &tempo);
    }
    if (running_ && view.grid != nullptr) {
      if (counting_in_) CancelCountIn();
      // Grid mode owns the beat clock; the ramp and polyrhythm are defined
      // against a constant BPM and do not apply. beat_position_ keeps running
      // so a clear lands where the song is, not on an instant downbeat.
      RenderGridSample(*view.grid, song, now, frame, sample_rate);
      beat_position_ += tempo.beats_per_sample;
    } else if (running_) {
      AdvanceConstantTempo(sample_rate, &tempo);
    }
    const float sample = RenderVoices() * volume_;
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      output[frame * channel_count + channel] += sample;
    }
  }

  PublishBlockMirrors(view.grid, block_start_frame + frame_count, sample_rate);
}

}  // namespace kitbag
