// The audio callback: voice synthesis and the per-sample sequencer loop.
// Allocation-free, lock-free, no syscalls (SPEC.md §4.5).
#include <cmath>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

namespace {

using metronome_detail::Clamp;
using metronome_detail::kGridEpsilon;
using metronome_detail::kSecondsPerMinute;

constexpr double kTau = 6.283185307179586;

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

void Metronome::OnBeatBoundary(int beat_index, uint32_t sample_rate) {
  current_beat_.store(beat_index, std::memory_order_relaxed);
  const Accent accent = beat_index >= 0 && beat_index < kMaxBeats
                            ? accents_[beat_index]
                            : Accent::kNormal;
  if (accent == Accent::kMuted || BarIsMuted(current_bar_)) return;
  const SoundPreset& sound = kSounds[sound_];
  const bool accented = accent == Accent::kAccented;
  TriggerClick(
      accented ? sound.accent_hz : sound.beat_hz,
      accented ? kAccentAmplitude : kBeatAmplitude,
      sound.decay_per_second,
      sample_rate
  );
}

void Metronome::OnSubdivisionTick(int64_t owning_beat, uint32_t sample_rate) {
  // owning_beat is the caller's speaker-time beat (position, not beat_position_):
  // a muted beat must silence its own subdivisions at the speaker, so attribution
  // uses the same latency-shifted base the tick fires on (#21, decisions.md).
  // Callers only fire at a non-negative beat, so no accents_[-1]; D5's 300ms
  // clamp lifts latency past one beat but keeps that invariant — revisit anyway.
  const int beat_in_bar = static_cast<int>(owning_beat % beats_per_bar_);
  if (accents_[beat_in_bar] == Accent::kMuted || BarIsMuted(current_bar_)) {
    return;
  }
  const SoundPreset& sound = kSounds[sound_];
  TriggerClick(
      sound.subdivision_hz,
      kSubdivisionAmplitude,
      sound.decay_per_second,
      sample_rate
  );
}

void Metronome::OnPolyBoundary(int poly_index, uint32_t sample_rate) {
  current_poly_beat_.store(poly_index, std::memory_order_relaxed);
  // Muted bars silence the poly voice too: the trainer's point is keeping
  // time internally, so nothing may sound during a muted bar.
  if (BarIsMuted(current_bar_)) return;
  const SoundPreset& sound = kSounds[sound_];
  TriggerClick(
      sound.poly_hz,
      kPolyAmplitude,
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
  tempo.beats_per_sample = bpm_ / (kSecondsPerMinute * sample_rate);
  tempo.latency_beats = LatencyBeats();
  tempo.poly_scale =
      static_cast<double>(poly_beats_) / static_cast<double>(beats_per_bar_);
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
    if (view.grid != nullptr) {
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
  if (view.grid == nullptr) return;
  // Seed at the anchor: the top-of-block re-seed already ran, and a cursor left
  // at the block start swallows every beat up to the anchor into one click.
  SeekGridCursor(*view.grid, GridSeconds(*view.grid, frame, sample_rate));
  observed_generation_ = view.generation;
}

void Metronome::SyncBarFromPosition() {
  const double position = beat_position_ + LatencyBeats();
  // The last beat strictly before `position` — the one already sounded. Below
  // the first downbeat there is none, so the bar counter waits at -1.
  const auto last_beat =
      static_cast<int64_t>(std::floor(position - kGridEpsilon));
  current_bar_ = last_beat < 0 ? -1 : last_beat / beats_per_bar_;
}

void Metronome::BeginAnchorExternal(
    uint64_t now,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  has_pending_anchor_ = false;
  has_pending_start_ = false;  // an anchor supersedes a deferred start
  ramp_enabled_ = false;  // an authoritative bpm cancels the ramp, as SetTempo
  bpm_ = Clamp(pending_anchor_bpm_, kMinBpm, kMaxBpm);
  const double song_seconds =
      pending_anchor_song_pos_ +
      (static_cast<double>(now) - static_cast<double>(pending_anchor_frame_)) /
          sample_rate;
  // position == song beats, so beat_position_ carries no latency term; the
  // per-sample bias in AdvanceConstantTempo adds it back (§4.7).
  beat_position_ = song_seconds * bpm_ / kSecondsPerMinute;
  running_ = true;
  running_flag_.store(true, std::memory_order_relaxed);
  observed_generation_ = 0;  // re-seed the grid cursor if a grid is present
  SyncBarFromPosition();
  *tempo = BlockTempoFor(sample_rate);
}

void Metronome::FireConstantTempoTick(
    int64_t sub_index,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  // Owning beat on the speaker-time base: sub_index came from position, and it
  // is >= 0 here (AdvanceConstantTempo fires only when position >= 0).
  const int64_t beat = sub_index / subdivision_;
  if (sub_index % subdivision_ != 0) {
    if (subdivision_ > 1) OnSubdivisionTick(beat, sample_rate);
    return;
  }
  const auto beat_index = static_cast<int>(beat % beats_per_bar_);
  if (beat_index == 0) {
    ++current_bar_;  // monotonic: survives time-signature changes
    if (ramp_enabled_) {
      SetBpmPreservingPhase(RampBpmForBar(current_bar_));
      *tempo = BlockTempoFor(sample_rate);
    }
  }
  OnBeatBoundary(beat_index, sample_rate);
}

void Metronome::FirePolyTick(
    double position,
    uint32_t sample_rate,
    const BlockTempo& tempo
) {
  const auto poly_index = static_cast<int64_t>(
      std::floor(position * tempo.poly_scale + kGridEpsilon)
  );
  const double poly_start = static_cast<double>(poly_index) / tempo.poly_scale;
  if (position - tempo.beats_per_sample < poly_start - kGridEpsilon) {
    OnPolyBoundary(static_cast<int>(poly_index % poly_beats_), sample_rate);
  }
}

void Metronome::AdvanceConstantTempo(uint32_t sample_rate, BlockTempo* tempo) {
  const double position = beat_position_ + tempo->latency_beats;
  // Before song beat 0 — a negative external-anchor position — there is no beat
  // to sound, mirroring grid mode's silence before its first beat (§4.2).
  if (position >= 0.0) {
    const auto sub_index = static_cast<int64_t>(
        std::floor(position * subdivision_ + kGridEpsilon)
    );
    const double sub_start = static_cast<double>(sub_index) / subdivision_;
    // A grid point fires on the first sample at or past it.
    if (position - tempo->beats_per_sample < sub_start - kGridEpsilon) {
      FireConstantTempoTick(sub_index, sample_rate, tempo);
    }
    if (poly_enabled_) FirePolyTick(position, sample_rate, *tempo);
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
    PublishGridMirrors(*grid, frame, sample_rate);
  } else {
    // Track `position`, not beat_position_, so the sweep, the LED and the
    // audible click share one time base (§4.5); the mapping to real latency
    // is §4.2's phase-anchor decision.
    const double position = beat_position_ + LatencyBeats();
    bar_phase_.store(
        std::fmod(position, static_cast<double>(beats_per_bar_)) /
            beats_per_bar_,
        std::memory_order_relaxed
    );
    current_bpm_.store(bpm_, std::memory_order_relaxed);
  }
  bar_muted_flag_.store(
      running_ && BarIsMuted(current_bar_),
      std::memory_order_relaxed
  );
}

Metronome::GridView Metronome::BeginBlock(
    uint64_t block_start_frame,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  ApplyPendingCommands();
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
    uint64_t block_start_frame
) {
  BlockTempo tempo{};
  const GridView view = BeginBlock(block_start_frame, sample_rate, &tempo);

  for (uint32_t frame = 0; frame < frame_count; ++frame) {
    const uint64_t now = block_start_frame + frame;
    if (has_pending_start_ && now >= pending_start_frame_) {
      BeginPendingStart(view, now, sample_rate, &tempo);
    }
    if (running_ && view.grid != nullptr) {
      // Grid mode owns the beat clock; the ramp and polyrhythm are defined
      // against a constant BPM and do not apply. beat_position_ keeps running
      // so a clear lands where the song is, not on an instant downbeat.
      RenderGridBeat(*view.grid, now, sample_rate);
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
