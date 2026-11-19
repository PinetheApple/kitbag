package com.kitbag.corenative.stemdeck

import java.io.EOFException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException
import org.junit.Assert.assertEquals
import org.junit.Test

class StemDeckFailureTest {
  private val networkOff =
    "StemDeck is not available on the network. Enable it in Settings on the host machine."
  private val needsHttps = "StemDeck needs an https:// address when reached from another device.\n\nBrowsers only..."

  @Test
  fun `statuses map to failures`() {
    val cases = listOf(
      Triple(403, networkOff, StemDeckFailure.NETWORK_OFF),
      Triple(403, needsHttps, StemDeckFailure.NEEDS_HTTPS),
      Triple(403, "Forbidden", StemDeckFailure.HTTP_ERROR),
      Triple(404, "{\"detail\":\"job not ready\"}", StemDeckFailure.NOT_FOUND),
      Triple(422, "{\"detail\":\"unknown stem requested\"}", StemDeckFailure.HTTP_ERROR),
      Triple(500, "", StemDeckFailure.HTTP_ERROR),
      Triple(302, "", StemDeckFailure.HTTP_ERROR),
    )
    cases.forEach { (status, body, code) -> assertEquals("$status $body", code, StemDeckFailure.ofFailedStatus(status, body)) }
  }

  @Test
  fun `errors map by when they happened`() {
    val changed = SSLHandshakeException("handshake").apply { initCause(CertificateChangedException("ab")) }
    val cases = listOf(
      Triple(ConnectException("refused"), false, StemDeckFailure.UNREACHABLE),
      Triple(NoRouteToHostException("no route"), false, StemDeckFailure.UNREACHABLE),
      Triple(UnknownHostException("studio.local"), false, StemDeckFailure.UNREACHABLE),
      Triple(SocketTimeoutException("connect"), false, StemDeckFailure.TIMED_OUT),
      Triple(SocketTimeoutException("read"), true, StemDeckFailure.DROPPED),
      Triple(EOFException("short"), true, StemDeckFailure.DROPPED),
      Triple(SSLHandshakeException("bad"), false, StemDeckFailure.TLS_FAILED),
      Triple(changed, false, StemDeckFailure.CERTIFICATE_CHANGED),
      Triple(StemDeckException(StemDeckFailure.NO_SPACE), true, StemDeckFailure.NO_SPACE),
      Triple(RuntimeException(StemDeckException(StemDeckFailure.HTTP_NOT_LOCAL)), false, StemDeckFailure.HTTP_NOT_LOCAL),
    )
    cases.forEach { (error, headers, code) -> assertEquals("$error", code, StemDeckFailure.of(error, headers)) }
  }

  @Test
  fun `only connection-wide failures stop the queue`() {
    val perSong = listOf(
      StemDeckFailure.NOT_FOUND,
      StemDeckFailure.HTTP_ERROR,
      StemDeckFailure.TOO_LARGE,
      StemDeckFailure.REFUSED,
      StemDeckFailure.ADD_FAILED,
      StemDeckFailure.NOT_ADDED,
    )
    val stopping = listOf(
      StemDeckFailure.DROPPED,
      StemDeckFailure.UNREACHABLE,
      StemDeckFailure.TIMED_OUT,
      StemDeckFailure.NO_SPACE,
      StemDeckFailure.CANCELLED,
      StemDeckFailure.TIME_LIMIT,
      StemDeckFailure.CERTIFICATE_CHANGED,
      StemDeckFailure.NETWORK_OFF,
    )
    assertEquals(perSong.map { false } + stopping.map { true }, (perSong + stopping).map(StemDeckFailure::stopsQueue))
  }
}
