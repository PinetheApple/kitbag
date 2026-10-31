#ifndef KITBAG_ENGINE_HOLD_API_H
#define KITBAG_ENGINE_HOLD_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Engine: device lifetime -------------------------------------------- */

/* The output device stops on its own once it has been idle for a short grace:
 * no holder is open, nothing intends to play, and the metronome and
 * mixer mirrors both read stopped. Play intent is set when kb_metronome_start,
 * kb_metronome_start_at, kb_metronome_anchor_external or kb_mixer_play is
 * called, not when the callback applies it, and cleared by the matching stop
 * or pause. The mixer's intent outlasts the end of a song until
 * kb_mixer_stop or kb_mixer_pause. The player is not covered: kb_player_play
 * sets no intent and does not keep the device.
 *
 * Those calls never start the device. Call kb_engine_start after them, never
 * only before: issued in that order, an idle stop cannot fall between the two
 * and leave a queued start silent.
 *
 * kb_engine_start, kb_engine_stop and the hold calls are serialized with each
 * other and with the idle stop, so any control thread may call them. They must
 * not overlap a load, unload, seek or grid call on another thread: those share
 * the retire lists a start or stop reclaims. kb_engine_stop stops the device at
 * once whatever is held or playing. */

/* Opens a holder (a screen or sheet that needs low-latency output) and starts
 * the device if it is stopped. Every call needs one kb_engine_release, even
 * when this returns KB_ERROR_DEVICE_START_FAILED. */
KB_EXPORT kb_result kb_engine_hold(kb_engine* engine);
/* Closes one holder; a release with none open is ignored. Never stops the
 * device itself: the idle rule above does, after its grace. */
KB_EXPORT void kb_engine_release(kb_engine* engine);
/* Closes every holder, for a JS reload whose surfaces never released theirs. */
KB_EXPORT void kb_engine_reset_holders(kb_engine* engine);

/* --- Engine: output route ----------------------------------------------- */

/* kb_engine_output_device_id when the id is unknown: AAUDIO_UNSPECIFIED, which
 * no AudioDeviceInfo.getId() returns. */
#define KB_NO_OUTPUT_DEVICE_ID 0

/* AudioDeviceInfo.getId() of the playing AAudio stream: a per-connection handle,
 * briefly stale after a failed reroute, so match it against the device list. */
KB_EXPORT int32_t kb_engine_output_device_id(const kb_engine* engine);

#ifdef KITBAG_BUILD_TOOLS
/* Verify only: open holders, whether the device is started, whether the idle
 * rule above holds now, and the idle grace in ms (0 stops on the watchdog's
 * next check). */
KB_EXPORT int32_t kb_engine_holders(const kb_engine* engine);
KB_EXPORT int32_t kb_engine_device_running(const kb_engine* engine);
KB_EXPORT int32_t kb_engine_idle(const kb_engine* engine);
KB_EXPORT void
kb_engine_set_idle_grace_ms(kb_engine* engine, uint32_t grace_ms);
#endif /* KITBAG_BUILD_TOOLS */

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_ENGINE_HOLD_API_H */
