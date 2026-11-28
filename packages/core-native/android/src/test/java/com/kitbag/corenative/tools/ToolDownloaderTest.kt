package com.kitbag.corenative.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.SocketException
import java.net.URL
import java.net.UnknownHostException

class ToolDownloaderTest {
  private val body = ByteArray(BODY_BYTES) { it.toByte() }
  private val start = URL("https://example.test/a")

  private fun fetch(
    max: Long = body.size.toLong(),
    sink: OutputStream = ByteArrayOutputStream(),
    mayConnect: () -> Boolean = { true },
    cancelled: () -> Boolean = { false },
  ) = ToolFetch(max, sink, {}, mayConnect, cancelled)

  private fun failure(connector: ToolConnector, fetch: ToolFetch = fetch(), from: URL = start) =
    try {
      ToolDownloader(connector).fetch(from, fetch)
      null
    } catch (error: ToolDownloadFailed) {
      error
    }

  private fun redirects(count: Int) = FakeConnector { url ->
    val hop = url.path.removePrefix("/hop").toIntOrNull() ?: 0
    if (hop < count) FakeResponse(HttpURLConnection.HTTP_MOVED_TEMP, location = "/hop${hop + 1}") else FakeResponse(body = body)
  }

  @Test
  fun `follows https redirects, resolving relative locations, up to the cap`() {
    val connector = redirects(ToolDownloader.MAX_REDIRECTS)
    val sink = ByteArrayOutputStream()

    val received = ToolDownloader(connector).fetch(start, fetch(sink = sink))

    assertEquals(body.size.toLong(), received)
    assertArrayEquals(body, sink.toByteArray())
    assertEquals(ToolDownloader.MAX_REDIRECTS + 1, connector.opened.size)
    assertEquals("https://example.test/hop${ToolDownloader.MAX_REDIRECTS}", connector.opened.last().toString())
  }

  @Test
  fun `one redirect past the cap is refused`() {
    val connector = redirects(ToolDownloader.MAX_REDIRECTS + 1)

    assertEquals(ToolRejection.TOO_MANY_REDIRECTS, failure(connector)?.rejection)
    assertEquals(ToolDownloader.MAX_REDIRECTS + 1, connector.opened.size)
  }

  @Test
  fun `never opens a plain http url, first or redirected`() {
    val toHttp = FakeConnector { FakeResponse(HttpURLConnection.HTTP_MOVED_PERM, location = "http://example.test/b") }
    val plain = FakeConnector { FakeResponse(body = body) }

    assertEquals(ToolRejection.NOT_HTTPS, failure(toHttp)?.rejection)
    assertEquals(listOf("https://example.test/a"), toHttp.opened.map { it.toString() })
    assertEquals(ToolRejection.NOT_HTTPS, failure(plain, from = URL("http://example.test/a"))?.rejection)
    assertTrue(plain.opened.isEmpty())
  }

  @Test
  fun `a declared length over the cap is refused before the body is read`() {
    var connection: FakeConnection? = null
    val connector = object : ToolConnector {
      override fun open(url: URL) = FakeConnection(url, FakeResponse(body = body)).also { connection = it }
    }

    assertEquals(ToolRejection.TOO_LARGE, failure(connector, fetch(max = body.size - 1L))?.rejection)
    assertFalse(connection!!.bodyRead)
  }

  @Test
  fun `an undeclared body stops at the cap and writes no byte past it`() {
    val sink = ByteArrayOutputStream()
    val connector = FakeConnector { FakeResponse(body = body, contentLength = -1) }

    assertEquals(ToolRejection.TOO_LARGE, failure(connector, fetch(max = CAP, sink = sink))?.rejection)
    assertTrue(sink.size() <= CAP)
  }

  @Test
  fun `a body shorter than declared is a retryable drop`() {
    val connector = FakeConnector { FakeResponse(body = body, stream = { ByteArrayInputStream(body, 0, CAP.toInt()) }) }

    val error = failure(connector)

    assertEquals(ToolRejection.DOWNLOAD, error?.rejection)
    assertEquals(CAP, error?.receivedBytes)
    assertTrue(error!!.retryable)
  }

  @Test
  fun `server errors retry, client errors do not, no connection is offline`() {
    val unavailable = failure(FakeConnector { FakeResponse(HttpURLConnection.HTTP_UNAVAILABLE) })
    val missing = failure(FakeConnector { FakeResponse(HttpURLConnection.HTTP_NOT_FOUND) })
    val offline = failure(FakeConnector { FakeResponse(connectError = UnknownHostException("example.test")) })

    assertEquals(ToolRejection.DOWNLOAD, unavailable?.rejection)
    assertTrue(unavailable!!.retryable)
    assertEquals(ToolRejection.DOWNLOAD, missing?.rejection)
    assertFalse(missing!!.retryable)
    assertEquals(ToolRejection.OFFLINE, offline?.rejection)
    assertTrue(offline!!.retryable)
  }

  @Test
  fun `a connection lost mid-body is offline, with the bytes received`() {
    val connector = FakeConnector { FakeResponse(body = body, stream = { DroppingStream(body, CAP.toInt()) { SocketException("reset") } }) }

    val error = failure(connector)

    assertEquals(ToolRejection.OFFLINE, error?.rejection)
    assertEquals(CAP, error?.receivedBytes)
    assertTrue(error!!.retryable)
  }

  @Test
  fun `opens nothing once it may not connect, and stops before following a redirect`() {
    var allowed = true
    val connector = FakeConnector {
      allowed = false
      FakeResponse(HttpURLConnection.HTTP_MOVED_TEMP, location = "/next")
    }

    val stopped = try {
      ToolDownloader(connector).fetch(start, fetch(mayConnect = { allowed }))
      null
    } catch (error: ToolInstallStopped) {
      error
    }

    assertTrue(stopped != null)
    assertEquals(1, connector.opened.size)
  }

  private companion object {
    const val BODY_BYTES = 200_000
    const val CAP = 1000L
  }
}
