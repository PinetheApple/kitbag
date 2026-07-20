#ifndef KITBAG_MEDIA_MINIAUDIO_DECODER_H
#define KITBAG_MEDIA_MINIAUDIO_DECODER_H

// miniaudio's type — third-party, its own naming convention.
struct ma_decoder;  // NOLINT(readability-identifier-naming)

namespace kitbag {

/// Opens `path` decoding to f32. Letting miniaudio default the format instead
/// gives the file's native one, so a 16-bit file writes s16 into float storage:
/// NaN, |x| to 1e38, back half unwritten. Every file open goes through here.
/// On false, `out` is uninitialised — free it, do not ma_decoder_uninit() it.
bool OpenDecoderF32(const char* path, ma_decoder* out);

}  // namespace kitbag

#endif  // KITBAG_MEDIA_MINIAUDIO_DECODER_H
