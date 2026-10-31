package com.kitbag.corenative

import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.LibraryStorage
import com.kitbag.corenative.library.UnsafeLibraryPathException
import com.kitbag.corenative.route.OutputRoute
import com.kitbag.corenative.route.OutputRouteWatcher
import com.kitbag.corenative.transport.Playback
import com.kitbag.corenative.transport.PracticeClock
import com.kitbag.corenative.transport.SetlistPosition
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongStepWire
import com.kitbag.corenative.transport.TransportAction
import com.kitbag.corenative.transport.TransportState

class KitbagCommandsModule(reactContext: ReactApplicationContext) :
  NativeKitbagCommandsSpec(reactContext) {

  private val libraryBase = LibraryStorage.base(reactContext)
  private val outputRoutes =
    OutputRouteWatcher(reactContext, ::outputDeviceId, ::emitOutputRoute)

  init {
    val runtimePtr = reactContext.javaScriptContextHolder?.get() ?: 0L
    if (runtimePtr != 0L) {
      nativeInstall(runtimePtr)
    }
    PlaybackService.listener = ::emitTransport
    outputRoutes.start()
  }

  override fun invalidate() {
    PlaybackService.listener = null
    outputRoutes.stop()
    super.invalidate()
  }

  override fun transportShow(state: ReadableMap) {
    PlaybackService.show(
      reactApplicationContext,
      TransportState(
        playback = if (state.getBoolean("playing")) Playback.PLAYING else Playback.PAUSED,
        bpm = state.getDouble("bpm"),
        rampRunning = state.getBoolean("rampRunning"),
        beatsPerBar = state.getInt("beatsPerBar"),
        beatUnit = state.getInt("beatUnit"),
        setlist = state.getMap("setlist")?.let(::setlistPosition),
      ),
      state.getDouble("minBpm"),
      state.getDouble("maxBpm"),
      state.getDouble("practicePlayedMs").toLong(),
      state.getDouble("practiceStretchStartedAt").toLong(),
    )
  }

  private fun setlistPosition(setlist: ReadableMap): SetlistPosition? =
    SetlistPosition.from(
      subtitle = setlist.getString("subtitle"),
      index = if (setlist.isNull("index")) null else setlist.getInt("index"),
      songCount = setlist.getInt("songCount"),
    )

  override fun transportHide() {
    PlaybackService.hide(reactApplicationContext)
  }

  override fun songTransportShow(state: ReadableMap) {
    PlaybackService.showSong(
      reactApplicationContext,
      Song(
        title = state.getString("title").orEmpty(),
        artist = state.getString("artist"),
        durationFrames = state.getDouble("durationFrames").toLong(),
        restartFromFrame = state.getDouble("restartFromFrame").toLong(),
        skipSeconds = state.getDouble("skipSeconds"),
      ),
      state.getBoolean("playing"),
    )
  }

  override fun songTransportHide() {
    PlaybackService.hideSong(reactApplicationContext)
  }

  override fun setKeepScreenOn(on: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      val flag = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      if (on) activity.window.addFlags(flag) else activity.window.clearFlags(flag)
    }
  }

  override fun getTypedExportedConstants(): Map<String, Any> =
    AppChrome.version(reactApplicationContext)

  override fun setAppNightMode(mode: String) {
    AppChrome.setNightMode(reactApplicationContext, mode)
  }

  override fun setSystemBarAppearance(light: Boolean) {
    AppChrome.setSystemBarAppearance(reactApplicationContext.currentActivity, light)
  }

  private fun emitTransport(
    state: TransportState,
    practice: PracticeClock,
    songStep: TransportAction?,
  ) {
    emitOnTransport(
      Arguments.createMap().apply {
        putString("playback", state.playback.name.lowercase())
        putDouble("bpm", state.bpm)
        putBoolean("rampRunning", state.rampRunning)
        putDouble("practicePlayedMs", practice.playedMillis.toDouble())
        putDouble("practiceStretchStartedAt", (practice.stretchStartedAt ?: 0L).toDouble())
        putString("songStep", SongStepWire.of(songStep))
      },
    )
  }

  override fun getOutputRoute(promise: Promise) {
    outputRoutes.report { promise.resolve(outputRouteMap(it)) }
  }

  private fun emitOutputRoute(route: OutputRoute) {
    emitOnOutputRoute(outputRouteMap(route))
  }

  private fun outputRouteMap(route: OutputRoute) =
    Arguments.createMap().apply {
      putString("id", route.id)
      putString("name", route.name)
      putString("kind", route.kind.wire)
      putBoolean("certain", route.certain)
    }

  override fun start(promise: Promise) {
    val result = nativeStart()
    outputRoutes.engineStarted()
    promise.resolve(result)
  }

  override fun stop() {
    nativeStop()
  }

  override fun engineHold(promise: Promise) {
    val result = nativeHold()
    outputRoutes.engineStarted()
    promise.resolve(result)
  }

  override fun engineRelease() {
    nativeRelease()
  }

  override fun metronomeStart(anchorFrame: Double) {
    nativeMetronomeStart(anchorFrame)
  }

  override fun metronomeStop() {
    nativeMetronomeStop()
  }

  override fun metronomePause() {
    nativeMetronomePause()
  }

  override fun setTempo(bpm: Double) {
    nativeSetTempo(bpm)
  }

  override fun setGrid(beatTimesSec: ReadableArray, anchorFrame: Double, promise: Promise) {
    val count = beatTimesSec.size()
    val times = DoubleArray(count) { i -> beatTimesSec.getDouble(i) }
    promise.resolve(nativeSetGrid(times, anchorFrame))
  }

  override fun clearGrid() {
    nativeClearGrid()
  }

  override fun metronomeFollowMixer(enabled: Boolean) {
    nativeFollowMixer(enabled)
  }

  override fun setBeats(beatsPerBar: Double, denominator: Double) {
    nativeSetBeats(beatsPerBar.toInt(), denominator.toInt())
  }

  override fun setSubdivision(subdivision: Double) {
    nativeSetSubdivision(subdivision.toInt())
  }

  override fun setAccent(beatIndex: Double, accent: Double) {
    nativeSetAccent(beatIndex.toInt(), accent.toInt())
  }

  override fun setPoly(enabled: Boolean, beats: Double) {
    nativeSetPoly(enabled, beats.toInt())
  }

  override fun setPolyAccent(beatIndex: Double, accent: Double) {
    nativeSetPolyAccent(beatIndex.toInt(), accent.toInt())
  }

  override fun setPolyAgainst(mainBeats: Double) {
    nativeSetPolyAgainst(mainBeats.toInt())
  }

  override fun setSounds(normalSound: Double, accentSound: Double) {
    nativeSetSounds(normalSound.toInt(), accentSound.toInt())
  }

  override fun previewSound(sound: Double, accented: Boolean) {
    nativePreviewSound(sound.toInt(), accented)
  }

  override fun setCountIn(bars: Double, distinct: Boolean, sound: Double) {
    nativeSetCountIn(bars.toInt(), distinct, sound.toInt())
  }

  override fun setVolume(volume: Double) {
    nativeSetVolume(volume)
  }

  override fun setLatencyOffset(latencyMs: Double) {
    nativeSetLatencyOffset(latencyMs)
  }

  override fun setRamp(
    enabled: Boolean,
    startBpm: Double,
    targetBpm: Double,
    stepBpm: Double,
    interval: Double,
    unit: Double,
    loop: Boolean,
  ) {
    nativeSetRamp(enabled, startBpm, targetBpm, stepBpm, interval, unit.toInt(), loop)
  }

  override fun setBarMute(enabled: Boolean, playBars: Double, muteBars: Double) {
    nativeSetBarMute(enabled, playBars.toInt(), muteBars.toInt())
  }

  override fun loadTrack(track: Double, relativePath: String, promise: Promise) {
    val file = try {
      LibraryPaths.resolve(libraryBase, relativePath)
    } catch (e: UnsafeLibraryPathException) {
      promise.reject(E_UNSAFE_PATH, "Track path escapes the library", e)
      return
    }
    promise.resolve(nativeLoadTrack(track.toInt(), file.path))
  }

  override fun mixerUnloadTrack(track: Double) {
    nativeUnloadTrack(track.toInt())
  }

  override fun mixerSetGain(track: Double, gain: Double) {
    nativeMixerSetGain(track.toInt(), gain)
  }

  override fun mixerSetMute(track: Double, muted: Boolean) {
    nativeMixerSetMute(track.toInt(), muted)
  }

  override fun mixerSetSolo(track: Double, soloed: Boolean) {
    nativeMixerSetSolo(track.toInt(), soloed)
  }

  override fun mixerSetMasterGain(gain: Double) {
    nativeMixerSetMasterGain(gain)
  }

  override fun mixerMasterGain(promise: Promise) {
    promise.resolve(nativeMixerMasterGain())
  }

  override fun mixerPlay() {
    nativeMixerPlay()
  }

  override fun mixerPause() {
    nativeMixerPause()
  }

  override fun mixerStop() {
    nativeMixerStop()
  }

  override fun mixerSeek(frame: Double) {
    nativeMixerSeek(frame)
  }

  override fun mixerSetLoop(startFrame: Double, endFrame: Double, promise: Promise) {
    promise.resolve(nativeMixerSetLoop(startFrame, endFrame))
  }

  override fun mixerClearLoop(promise: Promise) {
    promise.resolve(nativeMixerClearLoop())
  }

  override fun tunerStart(promise: Promise) {
    promise.resolve(nativeTunerStart())
  }

  override fun tunerStop() {
    nativeTunerStop()
  }

  override fun tunerSetTuning(instrument: Double, stringMidis: ReadableArray, promise: Promise) {
    val midis = IntArray(stringMidis.size()) { i -> stringMidis.getInt(i) }
    promise.resolve(nativeTunerSetTuning(instrument.toInt(), midis))
  }

  override fun tunerSetTargetString(stringIndex: Double, promise: Promise) {
    promise.resolve(nativeTunerSetTargetString(stringIndex.toInt()))
  }

  override fun tunerSetChromatic(promise: Promise) {
    promise.resolve(nativeTunerSetChromatic())
  }

  override fun tunerSetA4(a4Hz: Double, promise: Promise) {
    promise.resolve(nativeTunerSetA4(a4Hz))
  }

  override fun tunerResetNotePresence(pauseMs: Double, promise: Promise) {
    promise.resolve(nativeTunerResetNotePresence(pauseMs))
  }

  private external fun nativeInstall(runtimePtr: Long)
  private external fun nativeStart(): Int
  private external fun nativeStop()
  private external fun nativeHold(): Int
  private external fun nativeRelease()
  private fun outputDeviceId(): Int? =
    nativeOutputDeviceId().takeIf { it != NO_OUTPUT_DEVICE_ID }

  private external fun nativeOutputDeviceId(): Int
  private external fun nativeMetronomeStart(anchorFrame: Double)
  private external fun nativeMetronomeStop()
  private external fun nativeMetronomePause()
  private external fun nativeSetTempo(bpm: Double)
  private external fun nativeSetGrid(beatTimesSec: DoubleArray, anchorFrame: Double): Int
  private external fun nativeSetBeats(beatsPerBar: Int, denominator: Int)
  private external fun nativeSetSubdivision(subdivision: Int)
  private external fun nativeSetAccent(beatIndex: Int, accent: Int)
  private external fun nativeSetPoly(enabled: Boolean, beats: Int)
  private external fun nativeSetPolyAccent(beatIndex: Int, accent: Int)
  private external fun nativeSetPolyAgainst(mainBeats: Int)
  private external fun nativeSetSounds(normalSound: Int, accentSound: Int)
  private external fun nativePreviewSound(sound: Int, accented: Boolean)
  private external fun nativeSetCountIn(bars: Int, distinct: Boolean, sound: Int)
  private external fun nativeSetVolume(volume: Double)
  private external fun nativeSetLatencyOffset(latencyMs: Double)
  private external fun nativeSetRamp(
    enabled: Boolean,
    startBpm: Double,
    targetBpm: Double,
    stepBpm: Double,
    interval: Double,
    unit: Int,
    loop: Boolean,
  )
  private external fun nativeSetBarMute(enabled: Boolean, playBars: Int, muteBars: Int)
  private external fun nativeLoadTrack(track: Int, path: String): Int
  private external fun nativeUnloadTrack(track: Int)
  private external fun nativeMixerSetGain(track: Int, gain: Double)
  private external fun nativeMixerSetMute(track: Int, muted: Boolean)
  private external fun nativeMixerSetSolo(track: Int, soloed: Boolean)
  private external fun nativeMixerSetMasterGain(gain: Double)
  private external fun nativeMixerMasterGain(): Double
  private external fun nativeMixerPlay()
  private external fun nativeMixerPause()
  private external fun nativeMixerStop()
  private external fun nativeMixerSeek(frame: Double)
  private external fun nativeMixerSetLoop(startFrame: Double, endFrame: Double): Int
  private external fun nativeMixerClearLoop(): Int
  private external fun nativeClearGrid()
  private external fun nativeFollowMixer(enabled: Boolean)
  private external fun nativeTunerStart(): Int
  private external fun nativeTunerStop()
  private external fun nativeTunerSetTuning(instrument: Int, stringMidis: IntArray): Int
  private external fun nativeTunerSetTargetString(stringIndex: Int): Int
  private external fun nativeTunerSetChromatic(): Int
  private external fun nativeTunerSetA4(a4Hz: Double): Int
  private external fun nativeTunerResetNotePresence(pauseMs: Double): Int

  companion object {
    private const val E_UNSAFE_PATH = "E_UNSAFE_PATH"

    // Owned by KB_NO_OUTPUT_DEVICE_ID in kitbag_engine_hold_api.h.
    private const val NO_OUTPUT_DEVICE_ID = 0

    init {
      System.loadLibrary("kitbag_jsi")
    }
  }
}
