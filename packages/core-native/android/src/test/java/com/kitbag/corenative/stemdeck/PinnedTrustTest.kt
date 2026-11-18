package com.kitbag.corenative.stemdeck

import java.security.MessageDigest
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.X509TrustManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class PinnedTrustTest {
  private class FakeSystemTrust(private val trusts: Boolean) : X509TrustManager {
    var asked = 0

    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
      asked += 1
      if (!trusts) throw CertificateException("untrusted")
    }

    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
  }

  private val chainA = arrayOf(TestKey.A.certificate)
  private val chainB = arrayOf(TestKey.B.certificate)

  @Test
  fun `a fingerprint is the SHA-256 of the certificate in lowercase hex`() {
    val expected = MessageDigest.getInstance("SHA-256").digest(TestKey.A.certificate.encoded)
      .joinToString("") { "%02x".format(it) }
    assertEquals(expected, CertFingerprint.of(TestKey.A.certificate))
    assertEquals(64, expected.length)
    assertNotEquals(TestKey.A.fingerprint, TestKey.B.fingerprint)
    assertTrue(CertFingerprint.same(TestKey.A.fingerprint.uppercase(), TestKey.A.fingerprint))
  }

  @Test
  fun `a pin accepts its own certificate without asking Android`() {
    val system = FakeSystemTrust(trusts = false)
    val policy = TrustPolicy.Pinned(TestKey.A.fingerprint)
    PinnedTrustManager(system, policy).checkServerTrusted(chainA, "EC")
    assertEquals(0, system.asked)
  }

  @Test
  fun `a pin refuses any other certificate and records it`() {
    val policy = TrustPolicy.Pinned(TestKey.A.fingerprint)
    try {
      PinnedTrustManager(FakeSystemTrust(trusts = true), policy).checkServerTrusted(chainB, "EC")
      fail("a changed certificate was accepted")
    } catch (e: CertificateChangedException) {
      assertEquals(TestKey.B.fingerprint, e.presented)
    }
  }

  @Test
  fun `without a pin Android decides`() {
    PinnedTrustManager(FakeSystemTrust(trusts = true), TrustPolicy.System).checkServerTrusted(chainA, "EC")
    try {
      PinnedTrustManager(FakeSystemTrust(trusts = false), TrustPolicy.System).checkServerTrusted(chainA, "EC")
      fail("an untrusted chain was accepted")
    } catch (e: CertificateException) {
      assertEquals("untrusted", e.message)
    }
  }

  @Test
  fun `a probe accepts anything and records what it saw`() {
    val probe = TrustPolicy.Probe()
    PinnedTrustManager(FakeSystemTrust(trusts = false), probe).checkServerTrusted(chainB, "EC")
    assertEquals(TestKey.B.fingerprint, probe.presented)
    assertFalse(probe.chainTrusted)
    val trusted = TrustPolicy.Probe()
    PinnedTrustManager(FakeSystemTrust(trusts = true), trusted).checkServerTrusted(chainB, "EC")
    assertTrue(trusted.chainTrusted)
  }

  @Test(expected = CertificateException::class)
  fun `client certificates are refused`() {
    PinnedTrustManager(FakeSystemTrust(trusts = true), TrustPolicy.System).checkClientTrusted(chainA, "EC")
  }

  @Test
  fun `hostnames are checked only where Android vouches for the server`() {
    val refuses = HostnameVerifier { _, _ -> false }
    assertTrue(PolicyHostnameVerifier(refuses, TrustPolicy.Pinned(TestKey.A.fingerprint)).verify("x", null))
    assertFalse(PolicyHostnameVerifier(refuses, TrustPolicy.System).verify("x", null))
    val probe = TrustPolicy.Probe().apply { chainTrusted = true }
    assertTrue(PolicyHostnameVerifier(refuses, probe).verify("x", null))
    assertFalse(probe.systemVerified)
    PolicyHostnameVerifier({ _, _ -> true }, probe).verify("x", null)
    assertTrue(probe.systemVerified)
  }
}
