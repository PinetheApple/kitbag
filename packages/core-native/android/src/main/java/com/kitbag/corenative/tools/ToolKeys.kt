package com.kitbag.corenative.tools

import org.json.JSONException
import org.json.JSONObject
import java.security.GeneralSecurityException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

internal class PinnedToolKey(val keyId: String, val role: String, val status: String?, val publicKey: PublicKey)

internal enum class ToolKeyUse { INSTALL, LOAD }

internal class ToolKeyRing(
  private val keys: List<PinnedToolKey>,
  private val revokedKeyIds: Set<String>,
  private val rules: ToolBundleRules,
) {
  fun signer(keyId: String, use: ToolKeyUse): PublicKey? {
    val allowed = if (use == ToolKeyUse.INSTALL) rules.signingStatuses else rules.statuses
    return keys.firstOrNull {
      it.keyId == keyId && it.role == rules.toolRole && it.status != null && it.status in allowed &&
        keyId !in revokedKeyIds
    }?.publicKey
  }

  fun verify(data: ByteArray, signature: ByteArray, key: PublicKey): Boolean =
    try {
      Signature.getInstance(jcaAlgorithm(rules)).run {
        initVerify(key)
        update(data)
        verify(signature)
      }
    } catch (error: GeneralSecurityException) {
      false
    }

  companion object {
    private const val SCHEMA = "schema"
    private const val KEYS = "keys"
    private const val KEY_ID = "keyId"
    private const val ROLE = "role"
    private const val STATUS = "status"
    private const val SPKI = "spkiBase64"
    private const val KEY_ALGORITHM = "EC"
    private const val CURVE = "secp256r1"
    private val JCA_ALGORITHMS = mapOf("ES256" to "SHA256withECDSA")

    private val p256: ECParameterSpec by lazy {
      val generator = KeyPairGenerator.getInstance(KEY_ALGORITHM).apply { initialize(ECGenParameterSpec(CURVE)) }
      (generator.generateKeyPair().public as ECPublicKey).params
    }

    fun parse(pinFile: String, revokedKeyIds: Set<String>, rules: ToolBundleRules): ToolKeyRing {
      val keys = try {
        val json = JSONObject(pinFile)
        if (json.optInt(SCHEMA) != rules.schemaVersion) fail("is not a schema ${rules.schemaVersion} pin file")
        val pins = json.getJSONArray(KEYS)
        (0 until pins.length()).map { pin(pins.getJSONObject(it), rules) }
      } catch (error: JSONException) {
        fail("is not JSON: ${error.message}")
      }
      if (keys.map { it.keyId }.toSet().size != keys.size) fail("pins a keyId twice")
      return ToolKeyRing(keys, revokedKeyIds, rules)
    }

    private fun pin(json: JSONObject, rules: ToolBundleRules): PinnedToolKey {
      val keyId = json.getString(KEY_ID)
      if (!rules.keyId.matches(keyId)) fail("pin $keyId: keyId is not a key id")
      val role = json.getString(ROLE)
      if (role !in rules.roles) fail("pin $keyId: role must be one of ${rules.roles}")
      val status = if (json.has(STATUS)) json.getString(STATUS) else null
      val statusOk = if (role == rules.toolRole) status != null && status in rules.statuses else status == null
      if (!statusOk) fail("pin $keyId: a tool key needs a status of ${rules.statuses}, any other key none")
      val key = p256Key(json.getString(SPKI), rules) ?: fail("pin $keyId: spkiBase64 is not a P-256 SubjectPublicKeyInfo")
      return PinnedToolKey(keyId, role, status, key)
    }

    fun p256Key(spkiBase64: String, rules: ToolBundleRules): PublicKey? {
      val der = try {
        Base64.getDecoder().decode(spkiBase64)
      } catch (error: IllegalArgumentException) {
        return null
      }
      if (der.size != rules.spkiBytes) return null
      val key = try {
        KeyFactory.getInstance(KEY_ALGORITHM).generatePublic(X509EncodedKeySpec(der))
      } catch (error: GeneralSecurityException) {
        return null
      }
      val params = (key as? ECPublicKey)?.params ?: return null
      val onP256 = params.curve == p256.curve && params.generator == p256.generator &&
        params.order == p256.order && params.cofactor == p256.cofactor
      return if (onP256) key else null
    }

    private fun jcaAlgorithm(rules: ToolBundleRules): String =
      JCA_ALGORITHMS[rules.signatureAlg] ?: throw GeneralSecurityException("no JCA algorithm for ${rules.signatureAlg}")

    private fun fail(problem: String): Nothing = reject(ToolRejection.PINS, "the tool key pin file $problem")
  }
}
