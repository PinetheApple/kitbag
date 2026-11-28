package com.kitbag.corenative.tools

import java.io.IOException
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException

internal const val HTTPS_SCHEME = "https"

internal fun interface ToolConnector {
  fun open(url: URL): HttpURLConnection
}

internal object SystemToolConnector : ToolConnector {
  override fun open(url: URL): HttpURLConnection = url.openConnection() as HttpURLConnection
}

internal class ToolDownloadFailed(
  val rejection: ToolRejection,
  val receivedBytes: Long,
  val retryable: Boolean,
  message: String,
  cause: Throwable? = null,
) : Exception(message, cause)

internal class ToolFetch(
  val maxBytes: Long,
  val sink: OutputStream,
  val onBytes: (Long) -> Unit,
  val mayConnect: () -> Boolean,
  val cancelled: () -> Boolean,
)

internal class ToolDownloader(private val connector: ToolConnector) {
  fun fetch(start: URL, fetch: ToolFetch): Long {
    var url = start
    for (hop in 0..MAX_REDIRECTS) {
      if (fetch.cancelled() || !fetch.mayConnect()) throw ToolInstallStopped(0)
      if (url.protocol != HTTPS_SCHEME) fail(ToolRejection.NOT_HTTPS, "$url is not https")
      val connection = connector.open(url)
      try {
        configure(connection)
        val status = status(connection)
        if (status in REDIRECTS) {
          url = next(url, connection.getHeaderField(LOCATION))
          continue
        }
        if (status != HttpURLConnection.HTTP_OK) {
          val retryable = status in RETRYABLE || status >= HttpURLConnection.HTTP_INTERNAL_ERROR
          fail(ToolRejection.DOWNLOAD, "$url answered $status", retryable = retryable)
        }
        return body(connection, fetch)
      } finally {
        connection.disconnect()
      }
    }
    fail(ToolRejection.TOO_MANY_REDIRECTS, "more than $MAX_REDIRECTS redirects from $start")
  }

  private fun configure(connection: HttpURLConnection) {
    connection.instanceFollowRedirects = false
    connection.useCaches = false
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.setRequestProperty(ACCEPT_ENCODING, IDENTITY)
  }

  private fun status(connection: HttpURLConnection): Int =
    try {
      connection.responseCode
    } catch (error: IOException) {
      fail(lost(error), "request failed: ${error.message}", retryable = true, cause = error)
    }

  private fun lost(error: IOException): ToolRejection =
    when (error) {
      is UnknownHostException, is SocketException, is SocketTimeoutException -> ToolRejection.OFFLINE
      else -> ToolRejection.DOWNLOAD
    }

  private fun next(from: URL, location: String?): URL {
    if (location == null) fail(ToolRejection.DOWNLOAD, "$from redirected without a Location")
    return try {
      URL(from, location)
    } catch (error: MalformedURLException) {
      fail(ToolRejection.DOWNLOAD, "$from redirected to a malformed Location", cause = error)
    }
  }

  private fun body(connection: HttpURLConnection, fetch: ToolFetch): Long {
    val declared = connection.contentLengthLong
    if (declared > fetch.maxBytes) fail(ToolRejection.TOO_LARGE, "declares $declared bytes, over ${fetch.maxBytes}")
    var received = 0L
    val buffer = ByteArray(BUFFER_BYTES)
    try {
      connection.inputStream.use { input ->
        while (true) {
          if (fetch.cancelled()) throw ToolInstallStopped(received)
          val read = input.read(buffer, 0, minOf(buffer.size.toLong(), fetch.maxBytes - received + 1).toInt())
          if (read < 0) break
          received += read
          if (received > fetch.maxBytes) fail(ToolRejection.TOO_LARGE, "sent more than ${fetch.maxBytes} bytes", received)
          fetch.sink.write(buffer, 0, read)
          fetch.onBytes(received)
        }
      }
    } catch (error: IOException) {
      fail(lost(error), "connection dropped: ${error.message}", received, retryable = true, cause = error)
    }
    if (declared >= 0 && received != declared) {
      fail(ToolRejection.DOWNLOAD, "connection dropped at $received of $declared bytes", received, retryable = true)
    }
    return received
  }

  private fun fail(
    rejection: ToolRejection,
    message: String,
    received: Long = 0,
    retryable: Boolean = false,
    cause: Throwable? = null,
  ): Nothing = throw ToolDownloadFailed(rejection, received, retryable, message, cause)

  companion object {
    const val MAX_REDIRECTS = 5
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 30_000
    private const val BUFFER_BYTES = 64 * 1024
    private const val ACCEPT_ENCODING = "Accept-Encoding"
    private const val IDENTITY = "identity"
    private const val LOCATION = "Location"
    private const val TEMPORARY_REDIRECT = 307
    private const val PERMANENT_REDIRECT = 308
    private const val TOO_MANY_REQUESTS = 429
    private val REDIRECTS = setOf(
      HttpURLConnection.HTTP_MOVED_PERM,
      HttpURLConnection.HTTP_MOVED_TEMP,
      HttpURLConnection.HTTP_SEE_OTHER,
      TEMPORARY_REDIRECT,
      PERMANENT_REDIRECT,
    )
    private val RETRYABLE = setOf(HttpURLConnection.HTTP_CLIENT_TIMEOUT, TOO_MANY_REQUESTS)
  }
}
