package com.kitbag.corenative.stemdeck

import java.net.Socket
import java.security.KeyStore
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSession
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509ExtendedTrustManager
import javax.net.ssl.X509TrustManager

sealed class TrustPolicy {
  object System : TrustPolicy()

  // Cached with its context and shared by connections, so it holds nothing per connection.
  class Pinned(val fingerprint: String) : TrustPolicy()

  // Accepts whatever the server presents, for one connection that only asks /api/health.
  class Probe : TrustPolicy() {
    @Volatile var presented: String? = null

    @Volatile var chainTrusted = false

    // Set only by the explicit check after connecting; unset reads as no match.
    @Volatile var hostnameMatched: Boolean? = null

    val systemVerified: Boolean get() = chainTrusted && hostnameMatched == true
  }
}

class CertificateChangedException(val presented: String) : CertificateException("The server certificate changed")

class PinnedTrustManager(private val system: X509TrustManager, private val policy: TrustPolicy) :
  X509ExtendedTrustManager() {

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?, socket: Socket?) =
    check(chain) {
      if (system is X509ExtendedTrustManager) system.checkServerTrusted(chain, authType, socket)
      else system.checkServerTrusted(chain, authType)
    }

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?, engine: SSLEngine?) =
    check(chain) {
      if (system is X509ExtendedTrustManager) system.checkServerTrusted(chain, authType, engine)
      else system.checkServerTrusted(chain, authType)
    }

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) =
    check(chain) { system.checkServerTrusted(chain, authType) }

  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?, socket: Socket?) =
    refuseClient()

  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?, engine: SSLEngine?) =
    refuseClient()

  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = refuseClient()

  override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()

  private fun refuseClient(): Unit = throw CertificateException("Client certificates are not accepted")

  private fun check(chain: Array<out X509Certificate>?, systemCheck: () -> Unit) {
    val leaf = chain?.firstOrNull() ?: throw CertificateException("The server sent no certificate")
    val fingerprint = CertFingerprint.of(leaf)
    when (policy) {
      is TrustPolicy.Pinned ->
        if (!CertFingerprint.same(fingerprint, policy.fingerprint)) throw CertificateChangedException(fingerprint)
      TrustPolicy.System -> systemCheck()
      is TrustPolicy.Probe -> {
        policy.presented = fingerprint
        policy.chainTrusted = systemAccepts(systemCheck)
      }
    }
  }

  private fun systemAccepts(systemCheck: () -> Unit): Boolean =
    try {
      systemCheck()
      true
    } catch (e: CertificateException) {
      false
    }
}

class PolicyHostnameVerifier(private val default: HostnameVerifier, private val policy: TrustPolicy) :
  HostnameVerifier {
  // A pinned certificate is the identity: StemDeck's own certificate need not name the address typed.
  override fun verify(hostname: String?, session: SSLSession?): Boolean =
    when (policy) {
      is TrustPolicy.Pinned -> true
      TrustPolicy.System -> default.verify(hostname, session)
      is TrustPolicy.Probe -> true
    }
}

class TlsContexts(private val system: X509TrustManager) {
  private val pinned = ConcurrentHashMap<String, SSLSocketFactory>()
  private val systemFactory by lazy { build(TrustPolicy.System) }

  // Pinned and system contexts are cached so sessions resume; a probe never shares one.
  fun factory(origin: ServerOrigin, policy: TrustPolicy): SSLSocketFactory =
    when (policy) {
      is TrustPolicy.Pinned -> pinned.getOrPut("${origin.canonical} ${policy.fingerprint}") { build(policy) }
      TrustPolicy.System -> systemFactory
      is TrustPolicy.Probe -> build(policy)
    }

  fun forget(origin: ServerOrigin) {
    pinned.keys.removeAll { it.startsWith("${origin.canonical} ") }
  }

  private fun build(policy: TrustPolicy): SSLSocketFactory =
    SSLContext.getInstance(TLS).apply { init(null, arrayOf(PinnedTrustManager(system, policy)), null) }.socketFactory

  companion object {
    private const val TLS = "TLS"

    fun systemTrustManager(): X509TrustManager =
      TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        .apply { init(null as KeyStore?) }
        .trustManagers
        .filterIsInstance<X509TrustManager>()
        .first()
  }
}
