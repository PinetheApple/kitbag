package com.kitbag.corenative.stemdeck

import java.net.Socket
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StemDeckRequestTest {
  private fun request() =
    StemDeckRequest(URL("https://127.0.0.1:9/").openConnection() as HttpsURLConnection)

  private fun factory() = SSLContext.getDefault().socketFactory

  @Test
  fun `a socket made after an abort is closed as it is made`() {
    val request = request()
    val tracked = request.track(factory())
    request.abort()
    val socket: Socket = tracked.createSocket()
    assertTrue(socket.isClosed)
  }

  @Test
  fun `an abort closes the socket already made`() {
    val request = request()
    val socket = request.track(factory()).createSocket()
    assertFalse(socket.isClosed)
    request.abort()
    assertTrue(socket.isClosed)
  }

  @Test
  fun `a socket made with no abort stays open`() {
    val socket = request().track(factory()).createSocket()
    assertFalse(socket.isClosed)
    socket.close()
  }
}
