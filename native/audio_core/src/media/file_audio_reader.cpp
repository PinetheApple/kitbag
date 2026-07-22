#include "media/file_audio_reader.h"

#include "media/miniaudio_decoder.h"
#include "miniaudio.h"

namespace kitbag {

FileAudioReader::~FileAudioReader() {
  Close();
}

bool FileAudioReader::Open(const char* path) {
  Close();
  auto* decoder = new ma_decoder();
  if (!OpenDecoderF32(path, decoder)) {
    delete decoder;
    return false;
  }
  decoder_ = decoder;
  channels_ = decoder->outputChannels;
  sample_rate_ = decoder->outputSampleRate;
  ma_uint64 length = 0;
  ma_decoder_get_length_in_pcm_frames(decoder, &length);
  total_frames_ = length;
  return true;
}

void FileAudioReader::Close() {
  if (decoder_ == nullptr) return;
  ma_decoder_uninit(decoder_);
  delete decoder_;
  decoder_ = nullptr;
  channels_ = 0;
  sample_rate_ = 0;
  total_frames_ = 0;
}

ReadResult FileAudioReader::ReadFrames(float* dst, uint64_t frames) {
  if (decoder_ == nullptr) return {0, ReadStatus::kEndOfStream};
  ma_uint64 read = 0;
  const ma_result result =
      ma_decoder_read_pcm_frames(decoder_, dst, frames, &read);
  // A file has no "not ready yet": anything short is the end of it. A decode
  // error ends the stream too, so playback stops rather than looping on it.
  if (result != MA_SUCCESS || read < frames) {
    return {read, ReadStatus::kEndOfStream};
  }
  return {read, ReadStatus::kOk};
}

bool FileAudioReader::SeekToFrame(uint64_t frame) {
  if (decoder_ == nullptr) return false;
  // miniaudio accepts a seek past the end; the in-memory adapter refuses one.
  // The seam is worth less if the two disagree, so reject it here.
  if (frame > total_frames_) return false;
  return ma_decoder_seek_to_pcm_frame(decoder_, frame) == MA_SUCCESS;
}

}  // namespace kitbag
