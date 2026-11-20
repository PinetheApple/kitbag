package com.kitbag.corenative.library.move

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.kitbag.corenative.library.AwaySongCounts
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryErrors
import com.kitbag.corenative.library.PortableVolume
import com.kitbag.corenative.library.RootState
import java.util.concurrent.Executor

class DataFolderBridge(
  private val context: ReactApplicationContext,
  private val io: Executor,
  private val events: Events,
  private val rejectLogged: (Promise, String, String, Exception) -> Unit,
) {
  class Events(
    val progress: (ReadableMap) -> Unit,
    val finished: (ReadableMap) -> Unit,
    val folderChanged: () -> Unit,
  )

  private val moves = DataFolderMoves.get(context)
  private var stopWatching: (() -> Unit)? = null

  fun start() {
    stopWatching = moves.watch(::onEvent)
    recover()
  }

  fun stop() {
    stopWatching?.invoke()
    stopWatching = null
  }

  fun volumesChanged() = quietly("Leftover clean-up failed") { moves.finishLeftovers() }

  // At or after the switch, clean-up finishes on its own; before it, the move waits for Resume.
  private fun recover() =
    quietly("Move recovery failed") {
      moves.finishLeftovers()
      if (moves.status()?.let { it.switched && !it.running } == true) DataFolderMoveService.finishCleanup(context)
    }

  // Unasked work that fails here is retried at the next launch.
  private fun quietly(what: String, work: () -> Unit) =
    io.execute {
      try {
        work()
      } catch (e: Exception) {
        Log.w(MOVE_LOG_TAG, what, e)
      }
    }

  // Android 12+ refuses a foreground service started from the background.
  private fun launched(start: () -> Unit): MoveRefusal? =
    try {
      start()
      null
    } catch (e: IllegalStateException) {
      Log.w(MOVE_LOG_TAG, "Move service not started", e)
      MoveRefusal.FOREGROUND_REFUSED
    }

  fun listVolumes(promise: Promise) = answer(promise, "Could not list volumes") { volumeList() }

  fun startMove(volumeUuid: String?, promise: Promise) {
    val target = MoveReport.locationOf(volumeUuid)
    settle(promise) { moves.refusalToStart(target) ?: launched { DataFolderMoveService.start(context, target) } }
  }

  fun startCardReturn(volumeUuid: String, promise: Promise) {
    val card = DataFolderLocation.Card(volumeUuid)
    settle(promise) { moves.refusalToStart(card) ?: launched { DataFolderMoveService.returnCard(context, card) } }
  }

  fun resumeMove(promise: Promise) =
    settle(promise) { moves.refusalToResume() ?: launched { DataFolderMoveService.resume(context) } }

  fun cancelMove(promise: Promise) = settle(promise) { moves.cancel() }

  fun undoMove(promise: Promise) = settle(promise) { moves.undo() }

  fun moveStatus(promise: Promise) = answer(promise, "Could not read the move") { moves.status()?.let(::statusMap) }

  fun useInternalStorage(awayPaths: ReadableArray, promise: Promise) {
    val paths = (0 until awayPaths.size()).mapNotNull { awayPaths.getString(it) }
    settle(promise) { moves.useInternalStorage(paths) }
  }

  fun releaseOldCopies() =
    quietly("Old copies not released") {
      if (moves.releaseOldCopies()) DataFolderMoveService.finishCleanup(context)
    }

  private fun settle(promise: Promise, action: () -> MoveRefusal?) {
    io.execute {
      try {
        action()?.let { refuse(promise, it) } ?: promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, MoveReport.codeFor(e), "The move request failed", e)
      }
    }
  }

  private fun answer(promise: Promise, message: String, read: () -> Any?) {
    io.execute {
      try {
        promise.resolve(read())
      } catch (e: Exception) {
        rejectLogged(promise, MoveReport.codeFor(e), message, e)
      }
    }
  }

  private fun refuse(promise: Promise, refusal: MoveRefusal) =
    promise.reject(LibraryErrors.moveCode(refusal), "The move was refused: ${refusal.name}")

  private fun onEvent(event: MoveEvent) {
    when (event) {
      is MoveEvent.Progress -> events.progress(statusMap(event.status))
      is MoveEvent.Finished -> events.finished(finishedMap(MoveReport.finished(event.outcome)))
      MoveEvent.Switched -> events.folderChanged()
    }
  }

  private fun volumeList(): WritableMap {
    val folder = moves.folder
    val current = folder.location()
    val root = folder.rootStateAt(current) as? RootState.Mounted
    val volumes = Arguments.createArray()
    volumes.pushMap(internalVolume(current == DataFolderLocation.Internal))
    folder.portableVolumes().forEach { volumes.pushMap(cardVolume(it, current)) }
    return Arguments.createMap().apply {
      putString("currentVolumeUuid", MoveReport.volumeUuid(current))
      putBoolean("currentAvailable", root != null)
      if (root == null) {
        putNull("requiredBytes")
      } else {
        putDouble("requiredBytes", MovePlan.requiredBytes(root.root).toDouble())
      }
      putArray("volumes", volumes)
    }
  }

  private fun internalVolume(inUse: Boolean): WritableMap {
    val root = moves.folder.internalRoot
    return volumeMap(null, null, VOLUME_MOUNTED, inUse).apply {
      putDouble("freeBytes", DataFolderMoves.usableBytes(root).toDouble())
      putDouble("totalBytes", context.filesDir.totalSpace.toDouble())
      putAway(0, 0L, AwaySongCounts(songs = 0, stemSongs = 0))
    }
  }

  private fun cardVolume(volume: PortableVolume, current: DataFolderLocation): WritableMap {
    val state = when {
      volume.mounted -> VOLUME_MOUNTED
      volume.readOnly -> VOLUME_READ_ONLY
      else -> VOLUME_UNMOUNTED
    }
    val inUse = current == DataFolderLocation.Card(volume.uuid)
    val away = moves.folder.awayOnCard(volume.uuid)
    val awayBytes = away.sumOf { it.length() }
    val songs = moves.folder.awaySongCounts(volume.uuid)
    return volumeMap(volume.uuid, volume.description, state, inUse).apply {
      putDouble("freeBytes", DataFolderMoves.usableBytes(volume.filesDir).toDouble())
      putDouble("totalBytes", volume.filesDir.totalSpace.toDouble())
      putAway(away.size, awayBytes, songs)
    }
  }

  private fun WritableMap.putAway(files: Int, bytes: Long, songs: AwaySongCounts) {
    putInt("awayFiles", files)
    putDouble("awayBytes", bytes.toDouble())
    putDouble("awayRequiredBytes", (bytes + MoveRunner.FREE_SPACE_MARGIN_BYTES).toDouble())
    putInt("awaySongs", songs.songs)
    putInt("awayStemSongs", songs.stemSongs)
  }

  private fun volumeMap(uuid: String?, name: String?, state: String, inUse: Boolean): WritableMap =
    Arguments.createMap().apply {
      putString("volumeUuid", uuid)
      putString("name", name)
      putString("state", state)
      putBoolean("inUse", inUse)
    }

  private fun statusMap(status: MoveStatus): WritableMap {
    val progress = status.progress
    return Arguments.createMap().apply {
      putString("phase", progress.phase.name)
      putString("sourceVolumeUuid", MoveReport.volumeUuid(status.source))
      putString("targetVolumeUuid", MoveReport.volumeUuid(status.target))
      putDouble("doneBytes", progress.doneBytes.toDouble())
      putDouble("totalBytes", progress.totalBytes.toDouble())
      putInt("doneFiles", progress.doneFiles)
      putInt("totalFiles", progress.totalFiles)
      putString("path", progress.path)
      putBoolean("running", status.running)
      putBoolean("switched", status.switched)
      putBoolean("paused", status.paused)
      putBoolean("awaitingRelease", status.awaitingRelease)
      putBoolean("cardReturn", status.cardReturn)
      putString("error", MoveReport.errorOf(status))
    }
  }

  private fun finishedMap(report: FinishedReport): WritableMap =
    Arguments.createMap().apply {
      putString("outcome", report.outcome)
      putString("error", report.error)
      putString("path", report.path)
    }

  companion object {
    const val VOLUME_MOUNTED = "mounted"
    const val VOLUME_READ_ONLY = "readOnly"
    const val VOLUME_UNMOUNTED = "unmounted"

    val CONSTANTS: Map<String, Any> = MoveReport.CONSTANTS + mapOf(
      "volumeStates" to mapOf(
        VOLUME_MOUNTED to VOLUME_MOUNTED,
        VOLUME_READ_ONLY to VOLUME_READ_ONLY,
        VOLUME_UNMOUNTED to VOLUME_UNMOUNTED,
      ),
    )
  }
}
