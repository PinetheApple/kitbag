package com.kitbag.corenative.stemdeck

import java.net.Inet6Address
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class StemDeckHttpTest {
  private val health = """{"name":"StemDeck","status":"ok","version":"2.4.0"}""".toByteArray()
  private val servers = mutableListOf<FakeStemDeckServer>()

  private object NothingTrusted : X509TrustManager {
    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) =
      throw CertificateException("self-signed")

    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
  }

  private fun http(
    allowsPlain: (InetAddress) -> Boolean = { true },
    resolve: (String) -> Array<InetAddress> = InetAddress::getAllByName,
  ) = StemDeckHttp(TlsContexts(NothingTrusted), allowsPlain, resolve)

  private fun server(key: TestKey? = null, port: Int = 0, respond: (String, java.net.Socket) -> Unit) =
    FakeStemDeckServer(key?.serverContext(), port, respond).also { servers += it }

  private fun healthServer(key: TestKey? = null) = server(key) { _, socket -> FakeStemDeckServer.reply(socket, 200, health) }

  private fun failure(block: () -> Unit): String {
    try {
      block()
    } catch (e: Exception) {
      return StemDeckFailure.of(e, headersReceived = false)
    }
    fail("expected a failure")
    return ""
  }

  private fun changedFailure(block: () -> Unit): StemDeckException {
    try {
      block()
    } catch (e: StemDeckException) {
      return e
    }
    fail("expected a changed certificate")
    throw AssertionError()
  }

  @After
  fun tearDown() {
    servers.forEach { it.close() }
  }

  @Test
  fun `a probe records the certificate the server presented`() {
    val server = healthServer(TestKey.A)
    val probe = TrustPolicy.Probe()
    val text = http().text(server.origin, StemDeckApi.HEALTH_PATH, probe, 1024)
    assertEquals(String(health), text.body)
    assertEquals(TestKey.A.fingerprint, probe.presented)
    assertFalse(probe.systemVerified)
  }

  @Test
  fun `a pinned server with its own certificate answers`() {
    val server = healthServer(TestKey.A)
    val text = http().text(server.origin, StemDeckApi.HEALTH_PATH, TrustPolicy.Pinned(TestKey.A.fingerprint), 1024)
    assertEquals(200, text.status)
  }

  @Test
  fun `a changed certificate fails the handshake before any request byte is sent`() {
    val server = healthServer(TestKey.B)
    val pinned = TrustPolicy.Pinned(TestKey.A.fingerprint)
    val changed = changedFailure { http().text(server.origin, StemDeckApi.HEALTH_PATH, pinned, 1024) }
    assertEquals(StemDeckFailure.CERTIFICATE_CHANGED, changed.code)
    assertEquals(TestKey.B.fingerprint, changed.presentedFingerprint)
    server.awaitHandled()
    assertTrue(server.accepted.get() >= 1)
    assertEquals(emptyList<String>(), server.requests)
  }

  @Test
  fun `a self-signed server is refused without a pin`() {
    val server = healthServer(TestKey.A)
    val code = failure { http().text(server.origin, StemDeckApi.HEALTH_PATH, TrustPolicy.System, 1024) }
    assertEquals(StemDeckFailure.TLS_FAILED, code)
  }

  @Test
  fun `plain http reaches a local server at the address that was checked`() {
    val server = healthServer()
    var asked = ""
    val local = http(allowsPlain = { it.hostAddress == "127.0.0.1" }) { host ->
      asked = host
      arrayOf(FakeStemDeckServer.LOOPBACK)
    }
    val origin = ServerOrigin(ServerOrigin.HTTP, "studio.local", server.origin.port)
    assertEquals(String(health), local.text(origin, StemDeckApi.HEALTH_PATH, TrustPolicy.System, 1024).body)
    assertEquals("studio.local", asked)
    assertEquals("GET /api/health HTTP/1.1", server.requests.single())
  }

  @Test
  fun `plain http to loopback, a public address or a public name is refused without connecting`() {
    val server = healthServer()
    val guarded = StemDeckHttp(TlsContexts(NothingTrusted))
    assertEquals(StemDeckFailure.HTTP_NOT_LOCAL, failure { guarded.text(server.origin, "/", TrustPolicy.System, 1024) })
    val rebound = http(allowsPlain = LocalAddressGuard::allows) { arrayOf(InetAddress.getByName("8.8.8.8")) }
    val local = ServerOrigin(ServerOrigin.HTTP, "studio.local", server.origin.port)
    assertEquals(StemDeckFailure.HTTP_NOT_LOCAL, failure { rebound.text(local, "/", TrustPolicy.System, 1024) })
    val named = ServerOrigin(ServerOrigin.HTTP, "example.com", server.origin.port)
    assertEquals(StemDeckFailure.HTTP_NOT_LOCAL, failure { http().text(named, "/", TrustPolicy.System, 1024) })
    assertEquals(0, server.accepted.get())
  }

  @Test
  fun `StemDeck's 403s say which setting is off`() {
    val off = "StemDeck is not available on the network. Enable it in Settings on the host machine.".toByteArray()
    val server = server { _, socket -> FakeStemDeckServer.reply(socket, 403, off, contentType = "text/plain") }
    assertEquals(StemDeckFailure.NETWORK_OFF, failure { http().text(server.origin, "/", TrustPolicy.System, 1024) })
  }

  @Test
  fun `a redirect is not followed`() {
    val server = server { _, socket ->
      FakeStemDeckServer.reply(socket, 302, ByteArray(0), headers = mapOf("Location" to "http://8.8.8.8/"))
    }
    assertEquals(StemDeckFailure.HTTP_ERROR, failure { http().text(server.origin, "/", TrustPolicy.System, 1024) })
    server.awaitHandled()
    assertEquals(1, server.accepted.get())
  }

  @Test
  fun `a body over the cap is refused`() {
    val server = server { _, socket -> FakeStemDeckServer.reply(socket, 200, ByteArray(2048)) }
    assertEquals(StemDeckFailure.TOO_LARGE, failure { http().text(server.origin, "/", TrustPolicy.System, 1024) })
  }

  @Test
  fun `headers that do not arrive in time are a timeout, not a drop`() {
    val server = server { _, socket ->
      Thread.sleep(1000)
      FakeStemDeckServer.reply(socket, 200, health)
    }
    try {
      http().open(server.origin, "/", TrustPolicy.System, readTimeoutMillis = 200).close()
      fail("expected a timeout")
    } catch (e: SocketTimeoutException) {
      assertEquals(StemDeckFailure.TIMED_OUT, StemDeckFailure.of(e, headersReceived = false))
    }
  }

  @Test
  fun `requests ask for the body as sent`() {
    var head = ""
    val server = server { request, socket ->
      head = request
      FakeStemDeckServer.reply(socket, 200, health)
    }
    http().text(server.origin, StemDeckApi.JOBS_PATH, TrustPolicy.System, 1024)
    assertTrue(head.startsWith("GET /api/jobs "))
    assertTrue(head.lines().any { it.equals("Accept-Encoding: identity", ignoreCase = true) })
  }

  @Test
  fun `a second connection through one cached pin still reports the changed certificate`() {
    val http = http()
    val pinned = { TrustPolicy.Pinned(TestKey.A.fingerprint) }
    val first = healthServer(TestKey.A)
    http.text(first.origin, StemDeckApi.HEALTH_PATH, pinned(), 1024)
    first.close()
    val second = server(TestKey.B, first.origin.port) { _, socket -> FakeStemDeckServer.reply(socket, 200, health) }
    val changed = changedFailure { http.text(second.origin, StemDeckApi.HEALTH_PATH, pinned(), 1024) }
    assertEquals(TestKey.B.fingerprint, changed.presentedFingerprint)
  }

  @Test
  fun `a local name that resolves to scoped IPv6 and IPv4 is reached over IPv4`() {
    val server = healthServer()
    val scoped = Inet6Address.getByAddress(null, InetAddress.getByName("fe80::1").address, 1)
    val dual = http { arrayOf(scoped, FakeStemDeckServer.LOOPBACK) }
    val origin = ServerOrigin(ServerOrigin.HTTP, "studio.local", server.origin.port)
    assertEquals(String(health), dual.text(origin, StemDeckApi.HEALTH_PATH, TrustPolicy.System, 1024).body)
  }
}
