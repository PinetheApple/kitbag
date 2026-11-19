package com.kitbag.corenative.stemdeck

import java.security.MessageDigest
import java.security.cert.Certificate

object CertFingerprint {
  private const val ALGORITHM = "SHA-256"

  fun of(certificate: Certificate): String =
    MessageDigest.getInstance(ALGORITHM).digest(certificate.encoded).joinToString("") { "%02x".format(it) }

  fun same(a: String, b: String): Boolean =
    MessageDigest.isEqual(a.lowercase().toByteArray(), b.lowercase().toByteArray())
}
