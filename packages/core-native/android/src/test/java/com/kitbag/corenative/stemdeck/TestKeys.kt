package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import java.security.KeyStore
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext

class TestKey private constructor(private val store: KeyStore) {
  val certificate: X509Certificate = store.getCertificate(ALIAS) as X509Certificate

  val fingerprint: String = CertFingerprint.of(certificate)

  fun serverContext(): SSLContext {
    val keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
    keys.init(store, PASSWORD.toCharArray())
    return SSLContext.getInstance("TLS").apply { init(keys.keyManagers, null, null) }
  }

  companion object {
    private const val ALIAS = "stemdeck"
    private const val PASSWORD = "kitbag-test"
    private const val KEYTOOL_TIMEOUT_SECONDS = 60L

    private const val LOOPBACK_SAN = "ip:127.0.0.1"

    val A: TestKey by lazy { generate("a", LOOPBACK_SAN) }
    val B: TestKey by lazy { generate("b", LOOPBACK_SAN) }
    val OTHER_NAME: TestKey by lazy { generate("other", "dns:other.example") }

    // keytool ships with every JDK, so the tests make real self-signed certificates without a dependency.
    private fun generate(name: String, san: String): TestKey {
      val dir = Files.createTempDirectory("stemdeck-keys").toFile().apply { deleteOnExit() }
      val file = File(dir, "$name.p12").apply { deleteOnExit() }
      val keytool = File(System.getProperty("java.home"), "bin/keytool").path
      val process = ProcessBuilder(
        keytool, "-genkeypair", "-alias", ALIAS, "-keyalg", "EC", "-keysize", "256",
        "-dname", "CN=StemDeck $name", "-validity", "30", "-ext", "SAN=$san",
        "-storetype", "PKCS12", "-keystore", file.path, "-storepass", PASSWORD, "-keypass", PASSWORD, "-noprompt",
      ).redirectErrorStream(true).start()
      val output = process.inputStream.bufferedReader().readText()
      check(process.waitFor(KEYTOOL_TIMEOUT_SECONDS, TimeUnit.SECONDS) && process.exitValue() == 0) { output }
      val store = KeyStore.getInstance("PKCS12").apply { file.inputStream().use { load(it, PASSWORD.toCharArray()) } }
      return TestKey(store)
    }
  }
}
