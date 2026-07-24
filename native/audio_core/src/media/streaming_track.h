#ifndef KITBAG_MEDIA_STREAMING_TRACK_H
#define KITBAG_MEDIA_STREAMING_TRACK_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>

#include "media/audio_source.h"
#include "rt/rt_publisher.h"

namespace kitbag {

/// One streaming transport: a file (or caller-owned reader) resampled to the
/// engine rate, read ahead off-thread and swapped in by RtPublisher. The mixer
/// holds an array of these and the player holds one; each keeps its own
/// transport-length policy above this. The two app→RT disciplines (build-and-
/// swap, plus the #25 rebuild-on-live-seek) live here so a future concurrency
/// fix is authored once, not per transport (SPEC.md §4.1, §2.2).
class StreamingTrack {
 public:
  /// Largest block a drain services; a caller's scratch must be at least
  /// kMaxBlockFrames * kMaxChannels wide. Mono or stereo only. This is the one
  /// owner of both bounds — the mixer and player size their scratch to them.
  static constexpr uint32_t kMaxBlockFrames = 4096;
  static constexpr uint32_t kMaxChannels = 2;

  /// [engine_rate] is the device rate the source is resampled to on load, so a
  /// drain never sees a rate mismatch (SPEC.md §4.1).
  explicit StreamingTrack(uint32_t engine_rate) : engine_rate_(engine_rate) {}
  /// The publisher dtor deletes the live source; its dtor joins the read-ahead
  /// thread before the readers it points into die (see Source field order).
  ~StreamingTrack() = default;
  StreamingTrack(const StreamingTrack&) = delete;
  StreamingTrack& operator=(const StreamingTrack&) = delete;

  // ---- App thread: setup ----

  /// Load a file, streamed from disk. [now_frame]/[engine_running] date the
  /// retired source for deferred reclamation. False on null path or open failure.
  bool Load(const char* path, uint64_t now_frame, bool engine_running);
  /// Stream from a caller-owned reader that must outlive the track. Same publish
  /// discipline as Load; false on null reader or a source wider than stereo.
  bool
  LoadReader(SourceReader* reader, uint64_t now_frame, bool engine_running);
  /// Retire the source: publishes an empty node so the drain reads nothing, and
  /// the old source is reclaimed off the callback, never freed on it.
  void Unload(uint64_t now_frame, bool engine_running);
  bool ready() const {
    return published_.Get() != nullptr;
  }

  // ---- App thread: transport ----

  /// Start the read-ahead thread if idle, then block until it has primed.
  void StartAndPrime();
  /// Stop the read-ahead thread (pause); keeps position so a later Start resumes.
  void StopSource();
  /// Rewind to frame 0 for a full stop: rebuild-and-swap while the device is
  /// live (#25), in place only when quiescent.
  void RewindForStop(uint64_t now_frame, bool engine_running);
  /// Seek to [frame] at the engine rate. Returns false only when a live rebuild
  /// failed and the old source was resumed in place, so the owner can suppress
  /// the transport jump; true otherwise, including when nothing is loaded.
  bool Seek(uint64_t frame, uint64_t now_frame, bool engine_running);

  // ---- App thread: getters ----

  // live_num_frames() is the app-thread length; frames() its atomic mirror the
  // callback reads to end a transport.
  uint64_t live_num_frames() const {
    return live_num_frames_;
  }
  uint64_t frames() const {
    return num_frames_.load(std::memory_order_relaxed);
  }
  uint64_t buffered_frames() const {
    return live_source_ != nullptr ? live_source_->buffered_frames() : 0;
  }
  bool at_end() const {
    return live_source_ == nullptr || live_source_->is_at_end();
  }
  /// App thread, callback quiescent. Frees sources retired but not yet reclaimed.
  void ReleaseRetiredSources() {
    published_.ReclaimAll();
  }

  // ---- Realtime ----

  /// Drains one block of the published source into [scratch] (>= kMaxBlockFrames
  /// * kMaxChannels wide). Returns frames read and sets *channels; *channels is
  /// 0 (return 0) when nothing is published, so the caller skips it. RT-safe: one
  /// acquire load then a ring copy — allocates nothing, takes no lock.
  uint32_t
  DrainBlock(float* scratch, uint32_t frame_count, uint32_t* channels) const;
  /// Adds [frames] of [channels]-wide [scratch] to interleaved-stereo [output]
  /// at [gain] (mono spread to both). RT-safe.
  static void AddToOutput(
      const float* scratch,
      uint32_t channels,
      uint32_t frames,
      float* output,
      float gain
  );
  /// Realtime-safe buffered count through the published node (acquire load), for
  /// a concurrent test to observe a ring the callback drains (#25).
  uint64_t rt_buffered() const {
    const auto* node = published_.Get();
    return node != nullptr ? node->value.source->buffered_frames() : 0;
  }

 private:
  /// The published, playable source. `source` is declared LAST so its dtor —
  /// which joins the read-ahead thread — runs before the readers it points into
  /// are destroyed. Declaring it first was a teardown use-after-free.
  struct Source {
    uint32_t channels = 0;
    uint64_t num_frames = 0;
    std::unique_ptr<SourceReader> owned_reader;
    std::unique_ptr<SourceReader> resampler;
    std::unique_ptr<AudioSource> source;
  };

  bool BuildSource(Source& s, SourceReader* base);
  void
  Publish(std::unique_ptr<Source> s, uint64_t now_frame, bool engine_running);
  void Prime(AudioSource& src, uint64_t num_frames);
  // App thread. Builds a fresh source at `target` from the reader identity,
  // started and primed; null if the rebuild fails. No Clear on a ring the
  // callback reads, so it is safe while the old source is still live (#25).
  std::unique_ptr<Source> BuildReseekSource(uint64_t target);
  // App thread. Stops the old source, then swaps in a BuildReseekSource node.
  // Returns false if the rebuild failed and the old source was resumed in place.
  bool ReseekLive(uint64_t frame, uint64_t now_frame, bool engine_running);

  RtPublisher<Source> published_;
  AudioSource* live_source_ = nullptr;  // app thread; == the published source
  uint64_t live_num_frames_ = 0;        // app thread
  // Reader identity for a live-seek rebuild: a file re-opens `load_path_`, a
  // caller-owned track re-wraps `ext_reader_`.
  std::string load_path_;               // app thread; set by Load
  SourceReader* ext_reader_ = nullptr;  // app thread; set by LoadReader
  uint32_t engine_rate_;
  // Resampled length, atomic because the callback reads it to end a transport
  // while a load can overlap (#23). Relaxed — no ordering rides on it; the
  // source itself crosses via the publisher's release/acquire.
  std::atomic<uint64_t> num_frames_{0};
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_STREAMING_TRACK_H
