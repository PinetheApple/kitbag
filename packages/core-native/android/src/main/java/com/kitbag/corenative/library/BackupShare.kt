package com.kitbag.corenative.library

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.io.File
import java.util.concurrent.Executor

class BackupShare(
  private val context: ReactApplicationContext,
  private val io: Executor,
  private val rejectLogged: (Promise, String, String, Exception) -> Unit,
) {

  fun share(fileName: String, contents: String, promise: Promise) {
    if (!BackupFiles.isSafeFileName(fileName)) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a backup file name: $fileName")
      return
    }
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject(LibraryErrors.NO_ACTIVITY, "No foreground activity to share from")
      return
    }
    io.execute {
      val chooser = try {
        Intent.createChooser(sendIntent(write(fileName, contents)), null)
      } catch (e: Exception) {
        rejectLogged(promise, LibraryErrors.SHARE_FAILED, "Could not write the backup", e)
        return@execute
      }
      activity.runOnUiThread {
        try {
          activity.startActivity(chooser)
          promise.resolve(null)
        } catch (e: ActivityNotFoundException) {
          promise.reject(LibraryErrors.NO_SHARE_TARGET, "No app on this device can receive the backup", e)
        }
      }
    }
  }

  private fun write(fileName: String, contents: String): File {
    val dir = File(context.cacheDir, BackupFiles.SHARE_DIR).apply { mkdirs() }
    return File(dir, fileName).apply { writeText(contents, Charsets.UTF_8) }
  }

  // The chooser only passes the read grant on when the uri is also in clipData.
  private fun sendIntent(file: File): Intent {
    val uri = FileProvider.getUriForFile(context, authority(), file)
    return Intent(Intent.ACTION_SEND).apply {
      type = BackupFiles.JSON_MIME
      putExtra(Intent.EXTRA_STREAM, uri)
      clipData = ClipData.newRawUri(file.name, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
  }

  private fun authority() = "${context.packageName}$AUTHORITY_SUFFIX"

  private companion object {
    const val AUTHORITY_SUFFIX = ".kitbag.backups"
  }
}
