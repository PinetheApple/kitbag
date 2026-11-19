package com.kitbag.corenative

import android.view.Choreographer
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.kitbag.corenative.library.ClickSoundFiles
import com.kitbag.corenative.library.LibraryErrors
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderUnavailableException
import com.kitbag.corenative.library.MixdownExport
import com.kitbag.corenative.library.UnsafeLibraryPathException
import com.kitbag.corenative.route.OutputRoute
import com.kitbag.corenative.route.OutputRouteWatcher
import com.kitbag.corenative.transport.Playback
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongCommand
import com.kitbag.corenative.transport.appAction
import com.kitbag.corenative.transport.TransportChange
import com.kitbag.corenative.transport.TransportState

class KitbagCommandsModule(reactContext: ReactApplicationContext) :
  NativeKitbagCommandsSpec(reactContext) {

  private val mixdown = MixdownExport(reactContext.cacheDir)
  private val transportListener: (TransportChange) -> Unit = ::emitTransport
  private val songStoppedListener: () -> Unit = ::emitOnSongStopped
  private val songRequestListener: (SongCommand) -> Unit = ::emitSongRequest
  private val outputRoutes =
    OutputRouteWatcher(reactContext, ::outputDeviceId, ::emitOutputRoute)

  init {
    val runtimePtr = reactContext.javaScriptContextHolder?.get() ?: 0L
    if (runtimePtr != 0L) {
      nativeInstall(runtimePtr)
    }
    PlaybackService.listener = transportListener
    PlaybackService.songStoppedListener = songStoppedListener
    PlaybackService.songRequestListener = songRequestListener
    outputRoutes.start()
  }

  // A reloaded module's init can run before the old one's invalidate.
  override fun invalidate() {
    if (PlaybackService.listener === transportListener) PlaybackService.listener = null
    if (PlaybackService.songStoppedListener === songStoppedListener) {
      PlaybackService.songStoppedListener = null
    }
    if (PlaybackService.songRequestListener === songRequestListener) {
      PlaybackService.songRequestListener = null
    }
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
        subtitle = state.getMap("setlist")?.getString("subtitle"),
      ),
      state.getDouble("minBpm"),
      state.getDouble("maxBpm"),
      state.getDouble("practicePlayedMs").toLong(),
      state.getDouble("practiceStretchStartedAt").toLong(),
      state.getInt("cardNumber"),
    )
  }

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
      state.getBoolean("countingIn"),
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

  private fun emitTransport(change: TransportChange) {
    emitOnTransport(
      Arguments.createMap().apply {
        putString("playback", change.state.playback.name.lowercase())
        putDouble("bpm", change.state.bpm)
        putBoolean("rampRunning", change.state.rampRunning)
        putDouble("practicePlayedMs", change.practice.playedMillis.toDouble())
        putDouble("practiceStretchStartedAt", (change.practice.stretchStartedAt ?: 0L).toDouble())
        putInt("cardNumber", change.cardNumber)
        putBoolean("tempoSet", change.tempoSet)
      },
    )
  }

  private fun emitSongRequest(request: SongCommand) {
    emitOnSongTransport(
      Arguments.createMap().apply {
        putString("action", request.appAction)
        if (request is SongCommand.Seek) putDouble("frame", request.frame.toDouble()) else putNull("frame")
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

  override fun rigClickStart(bpm: Double, subdivision: Double, startFrame: Double, promise: Promise) {
    promise.resolve(nativeRigClickStart(bpm, subdivision.toInt(), startFrame))
  }

  override fun rigClickStop() {
    nativeRigClickStop()
  }

  override fun rigClickIsActive(promise: Promise) {
    promise.resolve(nativeRigClickIsActive())
  }

  override fun metronomePause() {
    nativeMetronomePause()
  }

  override fun setTempo(bpm: Double) {
    nativeSetTempo(bpm)
  }

  override fun setGrid(
    beatTimesSec: ReadableArray,
    downbeatIndices: ReadableArray,
    anchorFrame: Double,
    promise: Promise,
  ) {
    val times = DoubleArray(beatTimesSec.size()) { i -> beatTimesSec.getDouble(i) }
    val downbeats = IntArray(downbeatIndices.size()) { i -> downbeatIndices.getInt(i) }
    promise.resolve(nativeSetGrid(times, downbeats, anchorFrame))
  }

  override fun clearGrid() {
    nativeClearGrid()
  }

  override fun setGridGrouping(sizes: ReadableArray, promise: Promise) {
    val groups = IntArray(sizes.size()) { i -> sizes.getInt(i) }
    promise.resolve(nativeSetGridGrouping(groups))
  }

  override fun setGridRate(rate: Double, promise: Promise) {
    promise.resolve(nativeSetGridRate(rate.toInt()))
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

  override fun setSubdivisionAccents(subdivision: Double, slotMask: Double) {
    nativeSetSubdivisionAccents(subdivision.toInt(), slotMask.toInt())
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
      LibraryPaths.resolve(DataFolder.root(reactApplicationContext), relativePath)
    } catch (e: UnsafeLibraryPathException) {
      promise.reject(E_UNSAFE_PATH, "Track path escapes the library", e)
      return
    } catch (e: DataFolderUnavailableException) {
      promise.reject(LibraryErrors.DATA_FOLDER_UNAVAILABLE, "The data folder is not mounted", e)
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

  override fun songCountIn(
    endFrame: Double,
    beatFrames: Double,
    beatsPerBar: Double,
    startClick: Boolean,
    promise: Promise,
  ) {
    promise.resolve(nativeSongCountIn(endFrame, beatFrames, beatsPerBar.toInt(), startClick))
  }

  override fun songPause() {
    nativeSongPause()
  }

  override fun songStop() {
    nativeSongStop()
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

  override fun mixerSetRate(rate: Double, promise: Promise) {
    promise.resolve(nativeMixerSetRate(rate))
  }

  override fun mixerRate(promise: Promise) {
    promise.resolve(nativeMixerRate())
  }

  override fun mixerSetTrackPitch(track: Double, semitones: Double, promise: Promise) {
    promise.resolve(nativeMixerSetTrackPitch(track, semitones))
  }

  override fun mixerTrackPitch(track: Double, promise: Promise) {
    promise.resolve(nativeMixerTrackPitch(track))
  }

  override fun mixerTrackFrames(track: Double, promise: Promise) {
    promise.resolve(nativeMixerTrackFrames(track))
  }

  override fun mixdownStart(fileName: String, promise: Promise) {
    val started = mixdown.start(fileName)
    if (started == null) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not an export file name: $fileName")
      return
    }
    promise.resolve(
      Arguments.createMap().apply {
        putInt("result", started.result)
        putString("path", started.path)
      },
    )
  }

  override fun mixdownCancel() {
    mixdown.cancel()
  }

  override fun loadCustomSound(slot: Double, fileName: String, promise: Promise) {
    val file = ClickSoundFiles.resolve(reactApplicationContext.filesDir, fileName)
    if (file == null) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a click sound file name: $fileName")
      return
    }
    promise.resolve(nativeLoadCustomSound(slot, file.path))
  }

  override fun clearCustomSound(slot: Double) {
    nativeClearCustomSound(slot)
  }

  override fun customSoundLoaded(slot: Double, promise: Promise) {
    promise.resolve(nativeCustomSoundLoaded(slot))
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
  private external fun nativeRigClickStart(bpm: Double, subdivision: Int, startFrame: Double): Int
  private external fun nativeRigClickStop()
  private external fun nativeRigClickIsActive(): Boolean
  private external fun nativeMetronomePause()
  private external fun nativeSetTempo(bpm: Double)
  private external fun nativeSetGrid(
    beatTimesSec: DoubleArray,
    downbeatIndices: IntArray,
    anchorFrame: Double,
  ): Int
  private external fun nativeSetBeats(beatsPerBar: Int, denominator: Int)
  private external fun nativeSetGridGrouping(sizes: IntArray): Int
  private external fun nativeSetGridRate(rate: Int): Int
  private external fun nativeSetSubdivision(subdivision: Int)
  private external fun nativeSetSubdivisionAccents(subdivision: Int, slotMask: Int)
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
  private external fun nativeSongCountIn(
    endFrame: Double,
    beatFrames: Double,
    beatsPerBar: Int,
    startClick: Boolean,
  ): Int
  private external fun nativeSongPause()
  private external fun nativeSongStop()
  private external fun nativeMixerPause()
  private external fun nativeMixerStop()
  private external fun nativeMixerSeek(frame: Double)
  private external fun nativeMixerSetLoop(startFrame: Double, endFrame: Double): Int
  private external fun nativeMixerClearLoop(): Int
  private external fun nativeMixerSetRate(rate: Double): Int
  private external fun nativeMixerRate(): Double
  private external fun nativeMixerSetTrackPitch(track: Double, semitones: Double): Int
  private external fun nativeMixerTrackPitch(track: Double): Int
  private external fun nativeMixerTrackFrames(track: Double): Double
  private external fun nativeClearGrid()
  private external fun nativeFollowMixer(enabled: Boolean)
  private external fun nativeLoadCustomSound(slot: Double, path: String): Int
  private external fun nativeClearCustomSound(slot: Double)
  private external fun nativeCustomSoundLoaded(slot: Double): Boolean
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

  override fun focusReaderView(viewTag: Double) {
    val tag = viewTag.toInt()
    UiThreadUtil.runOnUiThread { focusAfterMount(tag, FOCUS_RETRY_FRAMES) }
  }

  // Fabric mounts in a frame callback posted before ours, and preallocates views
  // detached, so only an attached view has been mounted.
  private fun focusAfterMount(tag: Int, framesLeft: Int) {
    Choreographer.getInstance().postFrameCallback {
      val uiManager = UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, tag)
      // resolveView throws when the tag has no view state yet or its view is gone.
      val view = runCatching { uiManager?.resolveView(tag) }.getOrNull()
      if (view != null && view.isAttachedToWindow) {
        view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
      } else if (framesLeft > 0) {
        focusAfterMount(tag, framesLeft - 1)
      }
    }
  }
}

private const val FOCUS_RETRY_FRAMES = 5
