package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ServerProbeTest {
  private class SystemTrust(private val trusts: Boolean) : X509TrustManager {
    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
      if (!trusts) throw CertificateException("self-signed")
    }

    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
  }

  private val health = """{"name":"StemDeck","version":"2.4.0"}""".toByteArray()
  private val servers = mutableListOf<FakeStemDeckServer>()
  private lateinit var root: File
  private lateinit var store: ServerStore

  private fun http(systemTrusts: Boolean = false) =
    StemDeckHttp(TlsContexts(SystemTrust(systemTrusts)), allowsPlain = { true }, defaultVerifier = { _, _ -> true })

  private fun serve(key: TestKey, port: Int = 0) =
    FakeStemDeckServer(key.serverContext(), port) { _, socket -> FakeStemDeckServer.reply(socket, 200, health) }
      .also { servers += it }

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stemdeck-probe").toFile()
    store = ServerStore(File(root, ServerStore.FILE_NAME)) { 0L }
  }

  @After
  fun tearDown() {
    servers.forEach { it.close() }
    root.deleteRecursively()
  }

  @Test
  fun `a changed certificate is reported on a later connection through the same cached pin`() {
    val http = http()
    val probe = ServerProbe({ http }, store)
    val first = serve(TestKey.A)
    val origin = first.origin
    assertEquals(ServerProbe.TRUST_NEW, probe.probe(origin).trust)
    assertTrue(store.trust(origin, TestKey.A.fingerprint))
    assertEquals(ServerProbe.TRUST_PINNED, probe.probe(origin).trust)
    first.close()
    serve(TestKey.B, origin.port)
    val changed = probe.probe(origin)
    assertEquals(ServerProbe.TRUST_CHANGED, changed.trust)
    assertEquals(TestKey.B.fingerprint, changed.fingerprint)
    assertEquals(TestKey.A.fingerprint, changed.previousFingerprint)
    assertNull(changed.health)
    assertTrue(store.trust(origin, TestKey.B.fingerprint))
    assertEquals(ServerProbe.TRUST_PINNED, probe.probe(origin).trust)
  }

  @Test
  fun `a server Android vouched for that stops validating is changed, not new`() {
    val origin = serve(TestKey.A).origin
    val trusting = ServerProbe({ http(systemTrusts = true) }, store)
    assertEquals(ServerProbe.TRUST_SYSTEM, trusting.probe(origin).trust)
    assertTrue(store.trust(origin, null))
    val result = ServerProbe({ http(systemTrusts = false) }, store).probe(origin)
    assertEquals(ServerProbe.TRUST_CHANGED, result.trust)
    assertEquals(TestKey.A.fingerprint, result.fingerprint)
    assertNull(result.previousFingerprint)
    assertTrue(store.trust(origin, TestKey.A.fingerprint))
  }

  @Test
  fun `an unknown self-signed server is new and nothing is stored until trusted`() {
    val origin = serve(TestKey.A).origin
    val result = ServerProbe({ http() }, store).probe(origin)
    assertEquals(ServerProbe.TRUST_NEW, result.trust)
    assertEquals(String(health), result.health?.body)
    assertEquals(emptyList<KnownServer>(), store.all())
  }
}
