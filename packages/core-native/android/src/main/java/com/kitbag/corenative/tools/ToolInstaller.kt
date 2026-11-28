package com.kitbag.corenative.tools

import com.kitbag.corenative.library.DiskSync
import com.kitbag.corenative.library.DurableFiles
import com.kitbag.corenative.library.SystemDiskSync
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.URL
import java.util.UUID

internal fun interface ToolSpace {
  fun freeBytes(): Long
}

internal fun interface ToolInstallListener {
  fun onEvent(event: ToolInstallEvent)
}

internal class ToolInstallEvent(
  val toolId: String,
  val stage: ToolInstallStage,
  val receivedBytes: Long = 0,
  val totalBytes: Long = 0,
  val attempt: Int = 0,
  val failure: ToolRejection? = null,
  val detail: String? = null,
  val neededBytes: Long = 0,
  val freeBytes: Long = 0,
)

internal class ToolInstallRequest(val toolId: String, val allowOlder: Boolean)

internal class ToolRetry(val tries: Int = TRIES, val firstBackoffMs: Long = FIRST_BACKOFF_MS) {
  fun backoffMs(failedAttempt: Int): Long = firstBackoffMs shl (failedAttempt - 1)

  private companion object {
    const val TRIES = 3
    const val FIRST_BACKOFF_MS = 2_000L
  }
}

internal class ToolInstaller(
  private val installed: InstalledTools,
  private val rules: ToolBundleRules,
  private val keys: () -> ToolKeyRing,
  private val index: ToolIndexSource,
  private val hostVersionCode: Long,
  private val state: ToolInstallerState,
  private val downloader: ToolDownloader,
  private val space: ToolSpace,
  private val retry: ToolRetry = ToolRetry(),
  private val commit: (File, File) -> Boolean = File::renameTo,
  private val disk: DiskSync = SystemDiskSync,
) {
  private class NoSpace(val needed: Long, val free: Long) : Exception()

  private val source = ToolReleaseSource(rules)
  private val check = InstalledToolCheck(installed, rules, keys)

  fun verifiedIndex(): ToolIndex {
    val signed = index.read() ?: reject(ToolRejection.INDEX, "this build embeds no ${rules.indexFile}")
    return ToolIndexVerifier(rules, keys(), hostVersionCode).verify(signed)
  }

  fun setDownloads(downloads: ToolDownloads) =
    state.setDownloads(downloads) {
      check.all().mapNotNull { tool ->
        val version = tool.version ?: return@mapNotNull null
        val sha = tool.manifestSha256 ?: return@mapNotNull null
        tool.id to HighWaterMark(version, sha)
      }.toMap()
    }

  fun install(request: ToolInstallRequest, job: ToolJob, listener: ToolInstallListener) {
    listener.onEvent(outcome(request, job, listener))
  }

  private fun outcome(request: ToolInstallRequest, job: ToolJob, listener: ToolInstallListener): ToolInstallEvent {
    val id = request.toolId
    return try {
      installOrThrow(request, job, listener)
      ToolInstallEvent(id, ToolInstallStage.INSTALLED)
    } catch (failure: ToolRejected) {
      failed(id, failure.rejection, failure.message)
    } catch (stopped: ToolInstallStopped) {
      if (state.downloads() != ToolDownloads.ON) {
        failed(id, ToolRejection.DOWNLOADS_OFF, "tool downloads were turned off", stopped.receivedBytes)
      } else {
        ToolInstallEvent(id, ToolInstallStage.CANCELLED, receivedBytes = stopped.receivedBytes)
      }
    } catch (failure: ToolDownloadFailed) {
      failed(id, failure.rejection, failure.message, failure.receivedBytes)
    } catch (failure: NoSpace) {
      ToolInstallEvent(
        toolId = id,
        stage = ToolInstallStage.FAILED,
        failure = ToolRejection.NO_SPACE,
        neededBytes = failure.needed,
        freeBytes = failure.free,
      )
    } catch (failure: IOException) {
      failed(id, ToolRejection.IO, failure.message)
    } catch (failure: Throwable) {
      failed(id, ToolRejection.INTERNAL, failure.toString())
    }
  }

  private fun failed(id: String, rejection: ToolRejection, detail: String?, received: Long = 0) =
    ToolInstallEvent(id, ToolInstallStage.FAILED, receivedBytes = received, failure = rejection, detail = detail)

  private fun installOrThrow(request: ToolInstallRequest, job: ToolJob, listener: ToolInstallListener) {
    val id = request.toolId
    installed.requireValidId(id)
    requireDownloads()
    val index = verifiedIndex()
    val entry = index.entry(id) ?: reject(ToolRejection.NOT_IN_INDEX, "$id is not in this release's ${rules.indexFile}")
    checkRollback(id, entry.version, request.allowOlder)
    val free = space.freeBytes()
    if (free < entry.size) throw NoSpace(entry.size, free)
    val part = File(ensureDir(installed.stagingDir), UUID.randomUUID().toString() + PART_SUFFIX)
    try {
      download(source.kbtUrl(index.hostVersionName, entry.asset), entry, part, job, listener)
      listener.onEvent(ToolInstallEvent(id, ToolInstallStage.CHECKING, entry.size, entry.size))
      val tool = checked(part.readBytes(), entry)
      if (job.cancelled) throw ToolInstallStopped(entry.size)
      listener.onEvent(ToolInstallEvent(id, ToolInstallStage.INSTALLING, entry.size, entry.size))
      state.raiseHighWater(id, HighWaterMark(tool.manifest.version, tool.manifestSha256))
      moveIntoPlace(part, id)
    } finally {
      part.delete()
    }
  }

  private fun requireDownloads() {
    if (state.downloads() != ToolDownloads.ON) reject(ToolRejection.DOWNLOADS_OFF, "tool downloads are not on")
  }

  private fun checkRollback(id: String, version: String, allowOlder: Boolean) {
    val mark = state.highWater(id) ?: return
    if (!allowOlder && ToolVersions.compare(version, mark.version) < 0) {
      reject(ToolRejection.ROLLBACK, "$id $version is older than ${mark.version}, the newest installed here")
    }
  }

  private fun download(url: URL, entry: ToolIndexEntry, part: File, job: ToolJob, listener: ToolInstallListener) {
    var attempt = 1
    while (true) {
      try {
        FileOutputStream(part).use { output ->
          val fetch = ToolFetch(
            maxBytes = entry.size,
            sink = output,
            onBytes = { bytes -> listener.onEvent(ToolInstallEvent(entry.id, ToolInstallStage.DOWNLOADING, bytes, entry.size, attempt)) },
            mayConnect = { state.downloads() == ToolDownloads.ON },
            cancelled = { job.cancelled },
          )
          val received = downloader.fetch(url, fetch)
          if (received != entry.size) {
            throw ToolDownloadFailed(ToolRejection.DOWNLOAD, received, true, "ended at $received of ${entry.size} bytes")
          }
          disk.file(output)
        }
        return
      } catch (failure: ToolDownloadFailed) {
        if (!failure.retryable || attempt >= retry.tries) throw failure
        listener.onEvent(ToolInstallEvent(entry.id, ToolInstallStage.RETRYING, failure.receivedBytes, entry.size, attempt + 1))
        if (!job.pause(retry.backoffMs(attempt))) throw ToolInstallStopped(failure.receivedBytes)
        attempt++
      }
    }
  }

  private fun checked(kbt: ByteArray, entry: ToolIndexEntry): VerifiedTool {
    if (DurableFiles.sha256(kbt) != entry.kbtSha256) {
      reject(ToolRejection.NOT_AS_INDEXED, "${entry.asset} does not match the kbtSha256 the index lists")
    }
    val tool = ToolVerifier(rules, keys()).verify(kbt, entry.id, ToolKeyUse.INSTALL)
    if (tool.manifestSha256 != entry.manifestSha256 || tool.manifest.version != entry.version) {
      reject(ToolRejection.NOT_AS_INDEXED, "${entry.id}'s manifest is not the one the index lists")
    }
    checkCompatible(tool.manifest)
    return tool
  }

  private fun checkCompatible(manifest: ToolManifest) {
    val inRange = hostVersionCode >= manifest.minVersionCode &&
      (manifest.maxVersionCode == null || hostVersionCode <= manifest.maxVersionCode)
    if (!inRange) reject(ToolRejection.INCOMPATIBLE, "${manifest.id} ${manifest.version} does not run on versionCode $hostVersionCode")
    val apiFits = manifest.hostApiMajor == rules.hostApiMajor.toLong() && rules.hostApiMinor >= manifest.hostApiMinMinor
    if (!apiFits) {
      reject(
        ToolRejection.INCOMPATIBLE,
        "${manifest.id} needs host API ${manifest.hostApiMajor}.${manifest.hostApiMinMinor}, this host is ${rules.hostApiMajor}.${rules.hostApiMinor}",
      )
    }
  }

  private fun moveIntoPlace(part: File, id: String) {
    val dir = ensureDir(installed.toolDir(id))
    disk.directory(installed.toolsDir)
    if (!commit(part, installed.kbtFile(id))) throw IOException("Could not move $id into place")
    disk.directory(dir)
  }

  fun remove(id: String) {
    val dir = installed.toolDir(id)
    if (!dir.exists()) return
    val doomed = File(ensureDir(installed.stagingDir), UUID.randomUUID().toString() + REMOVED_SUFFIX)
    if (!dir.renameTo(doomed)) throw IOException("Could not remove $id")
    disk.directory(installed.toolsDir)
    doomed.deleteRecursively()
  }

  fun cleanAtStart() {
    installed.stagingDir.deleteRecursively()
    installed.toolsDir.listFiles().orEmpty()
      .filter { it.isDirectory && rules.id.matches(it.name) && !installed.kbtFile(it.name).isFile }
      .forEach { it.deleteRecursively() }
  }

  private companion object {
    const val PART_SUFFIX = ".part"
    const val REMOVED_SUFFIX = ".removed"
  }
}
