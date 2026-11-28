package com.kitbag.corenative.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.Base64
import java.util.concurrent.TimeUnit

class OpenSslSignedToolTest {
  private val dir: File = Files.createTempDirectory("kitbag-openssl").toFile().apply { deleteOnExit() }
  private val keyId = RULES.testKeyPrefix + "openssl"

  private fun openssl(vararg args: String): ByteArray {
    val process = try {
      ProcessBuilder(OPENSSL, *args).directory(dir).redirectError(ProcessBuilder.Redirect.INHERIT).start()
    } catch (error: java.io.IOException) {
      throw AssertionError("openssl must be on PATH to check the signature format sign-tools.sh writes", error)
    }
    val output = process.inputStream.readBytes()
    check(process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS) && process.exitValue() == 0) { "openssl ${args.toList()} failed" }
    return output
  }

  private fun signedByOpenSsl(manifestBytes: ByteArray): Pair<ByteArray, ToolKeyRing> {
    openssl("genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", KEY)
    val spki = openssl("pkey", "-in", KEY, "-pubout", "-outform", "DER")
    File(dir, RULES.manifestFile).writeBytes(manifestBytes)
    openssl("dgst", "-sha256", "-sign", KEY, "-out", RULES.manifestSigFile, RULES.manifestFile)
    val pins = TestPins.ring(Pin(keyId, Base64.getEncoder().encodeToString(spki), status = TestPins.CURRENT))
    return File(dir, RULES.manifestSigFile).readBytes() to pins
  }

  @Test
  fun `a manifest signed the way the release script signs it verifies, and tampered bytes do not`() {
    val manifestBytes = TestTool.manifest(keyId).toString().toByteArray()
    val (signature, pins) = signedByOpenSsl(manifestBytes)
    val verifier = ToolVerifier(RULES, pins)
    val kbt = TestTool.kbt(manifestBytes, signature)

    assertArrayEquals(TestTool.BYTECODE, verifier.verify(kbt, TestTool.ID, ToolKeyUse.INSTALL).bytecode)

    val nameValue = String(manifestBytes).indexOf(TestTool.manifest(keyId).getString("name")) + 1
    val bytecodeData = String(kbt, Charsets.ISO_8859_1).indexOf(RULES.entryFile) + RULES.entryFile.length
    val flippedManifest = flip(manifestBytes, nameValue)
    val flippedSignature = flip(signature, signature.size - 1)
    val flippedArchive = flip(kbt, bytecodeData)

    assertEquals(
      ToolRejection.SIGNATURE,
      rejectedWith { verifier.verify(TestTool.kbt(flippedManifest, signature), TestTool.ID, ToolKeyUse.INSTALL) }?.rejection,
    )
    assertEquals(
      ToolRejection.SIGNATURE,
      rejectedWith { verifier.verify(TestTool.kbt(manifestBytes, flippedSignature), TestTool.ID, ToolKeyUse.INSTALL) }?.rejection,
    )
    assertEquals(ToolRejection.ZIP, rejectedWith { verifier.verify(flippedArchive, TestTool.ID, ToolKeyUse.INSTALL) }?.rejection)
  }

  private fun flip(bytes: ByteArray, at: Int): ByteArray =
    bytes.copyOf().also { it[at] = (it[at].toInt() xor 1).toByte() }

  private companion object {
    const val OPENSSL = "openssl"
    const val KEY = "key.pem"
    const val TIMEOUT_SECONDS = 60L
  }
}
