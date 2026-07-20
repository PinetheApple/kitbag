#ifndef KITBAG_MEDIA_AUDIO_SOURCE_H
#define KITBAG_MEDIA_AUDIO_SOURCE_H

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <thread>
#include <vector>

#include "rt/spsc_bulk_ring.h"

namespace kitbag {

enum class ReadStatus {
  kOk,           // the full request was satisfied
  kEndOfStream,  // fewer frames than requested, and there will be no more
  kWouldBlock,   // fewer frames than requested, but the stream is not finished
};

struct ReadResult {
  uint64_t frames = 0;
  ReadStatus status = ReadStatus::kEndOfStream;
};

// The seam AudioSource streams through. Every method runs on the read-ahead
// thread, or on the app thread while that thread is stopped — never in the
// audio callback, which is what lets an implementation block, allocate and
// touch the filesystem.
//
// kWouldBlock is separate from kEndOfStream because a short read alone cannot
// distinguish "the file ended" from "the disk is not ready"; the first is a
// legitimate end, the second is an underrun the caller must be told about.
class SourceReader {
 public:
  virtual ~SourceReader() = default;
  virtual uint32_t channels() const = 0;
  // On the interface rather than only the file adapter: the mixer and the
  // player both need it to resample, and reaching it by downcast would drag
  // miniaudio into the packages this seam exists to keep it out of.
  virtual uint32_t sample_rate() const = 0;
  virtual uint64_t total_frames() const = 0;
  virtual ReadResult ReadFrames(float* dst, uint64_t frames) = 0;
  virtual bool SeekToFrame(uint64_t frame) = 0;
};

// Deep module: a pull interface over a ring-buffered read-ahead thread.
//
// Read() is the only method the audio callback may call. It copies out of the
// ring and does nothing else — no allocation, no lock, no syscall, no virtual
// dispatch. The reader thread owns all of that.
//
// Lifecycle, split so that pause/resume costs nothing:
//
//   Open   configures and allocates; resets position, end of stream and the
//          underrun count. Legal without an intervening Close — that is the
//          load-a-new-track path — and it reallocates the ring, so whatever
//          the previous stream had buffered is discarded.
//   Start  spawns the read-ahead thread.
//   Stop   joins it, keeping the ring and the position — this is pause, and a
//          Start after it resumes without dropping a frame.
//   Seek   repositions; legal only while stopped, and discards the ring.
//   Close  stops and forgets the reader. It does not reset position() or
//          underruns(): they keep reporting the closed stream's last values
//          until the next Open, so a caller may read them after playback ends.
//
// Threading contract:
//   * Start and Stop are safe while the audio callback runs. They only create
//     and join the producer; no buffer moves under the consumer.
//   * Open, Close, Seek and the destructor are not. Open reallocates the ring
//     the callback memcpys out of, and Seek rewrites indices the callback
//     owns. The caller must guarantee the callback is quiescent across those.
//
// Read contract:
//   * While a stream is open: returns the number of frames actually delivered
//     and zero-fills the remainder of `dst`, so a starved or finished source
//     is silence rather than stale audio, and a caller that ignores the return
//     value still mixes something valid.
//   * On a closed or never-opened source that guarantee does not hold: with no
//     channel count there is no way to know how many samples `frames` denotes,
//     so Read returns 0 and leaves `dst` untouched. A caller iterating slots
//     must skip the ones it has not opened rather than mix their buffers.
//   * A short read at end of stream is normal; is_at_end() then reports true
//     once the ring has also drained. A short read before that is an underrun
//     and increments underruns(), a polled mirror for the UI.
//   * Startup counts. The callback's first Read normally precedes the
//     producer's first chunk, so a healthy stream reports underruns() >= 1.
//     Priming in Open would not fix this — a first request wider than one
//     refill chunk still starves — so the count is documented rather than
//     papered over: compare it against its value after the first block, not
//     against zero.
class AudioSource {
 public:
  // ~0.17s of stereo read-ahead at 48kHz: long enough to cover a scheduler
  // stall, short enough that O(tracks) memory stays trivial.
  static constexpr uint32_t kDefaultRingFrames = 8192;

  AudioSource() = default;
  ~AudioSource();
  AudioSource(const AudioSource&) = delete;
  AudioSource& operator=(const AudioSource&) = delete;

  // App thread, callback quiescent. `reader` stays owned by the caller and must
  // outlive Close(). Returns false if the source is already running, if
  // `reader` is null, if it reports no channels, or if `ring_frames` is zero.
  bool Open(SourceReader* reader, uint32_t ring_frames = kDefaultRingFrames);

  // App thread. Returns false if nothing is open, or if it is already running.
  bool Start();

  // App thread. Joins the read-ahead thread; safe when not running.
  void Stop();

  // App thread, callback quiescent, only while stopped. Returns false if
  // running, if nothing is open, or if the reader refuses the seek.
  bool Seek(uint64_t frame);

  // App thread, callback quiescent.
  void Close();

  // Realtime. Delivers up to `frames` frames of interleaved audio.
  uint32_t Read(float* dst, uint32_t frames);

  // Realtime-safe polled mirrors.
  bool is_at_end() const;

  // Absolute frame index the next Read will deliver. Counts what reached the
  // callback rather than what the read-ahead thread has buffered, so it is the
  // playback position, not the decode position.
  uint64_t position() const {
    return position_.load(std::memory_order_relaxed);
  }

  // Cumulative since the last Open. Seek and pause/resume deliberately do not
  // clear it: it is a health signal for one loaded stream, not per-transport.
  uint64_t underruns() const {
    return underruns_.load(std::memory_order_relaxed);
  }
  // Atomic where the others in this group are not: channels_ is the one field
  // Read itself loads, so it crosses to the realtime thread. sample_rate_ is
  // only ever read by the app thread, which is why it stays plain.
  uint32_t channels() const {
    return channels_.load(std::memory_order_relaxed);
  }
  uint32_t sample_rate() const {
    return sample_rate_;
  }
  bool is_running() const {
    return running_.load(std::memory_order_relaxed);
  }

 private:
  void RefillLoop();
  bool RefillOnce();
  void WaitForSpace();
  void WaitForStop();

  SpscBulkRing<float> ring_;
  SourceReader* reader_ = nullptr;
  std::vector<float> staging_;  // reader thread only
  std::thread thread_;
  std::mutex mutex_;  // guards the stop signal only; never taken by Read
  std::condition_variable cv_;
  std::atomic<bool> running_{false};
  // Two flags, because one store cannot order both jobs. `input_exhausted_` is
  // set before the final chunk is written, so no read past it is miscounted as
  // an underrun; `end_of_stream_` is set after, so is_at_end() never fires
  // while that chunk is still in flight.
  std::atomic<bool> input_exhausted_{false};
  std::atomic<bool> end_of_stream_{false};
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> position_{0};
  // Written by Open and Close, read by Read.
  std::atomic<uint32_t> channels_{0};
  uint32_t sample_rate_ = 0;
  uint32_t chunk_frames_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_AUDIO_SOURCE_H
