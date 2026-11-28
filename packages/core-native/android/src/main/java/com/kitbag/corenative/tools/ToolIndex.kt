package com.kitbag.corenative.tools

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

internal class SignedToolIndex(val bytes: ByteArray, val signature: ByteArray)

internal fun interface ToolIndexSource {
  fun read(): SignedToolIndex?
}

internal class ToolIndexEntry(
  val id: String,
  val version: String,
  val name: String,
  val icon: String,
  val summary: String?,
  val asset: String,
  val size: Long,
  val kbtSha256: String,
  val manifestSha256: String,
  val capabilities: List<String>,
)

internal class ToolIndex(val hostVersionName: String, val tools: List<ToolIndexEntry>) {
  fun entry(id: String): ToolIndexEntry? = tools.firstOrNull { it.id == id }
}

internal class ToolIndexVerifier(
  private val rules: ToolBundleRules,
  private val keys: ToolKeyRing,
  private val hostVersionCode: Long,
) {
  fun verify(signed: SignedToolIndex): ToolIndex {
    val json = parse(signed.bytes)
    val keyId = signingKeyId(json)
    val key = keys.signer(keyId, ToolKeyUse.INSTALL)
      ?: reject(ToolRejection.UNTRUSTED_KEY, "${rules.indexFile} is signed by $keyId, not a pinned, unrevoked current or next tool key")
    if (!keys.verify(signed.bytes, signed.signature, key)) {
      reject(ToolRejection.SIGNATURE, "${rules.indexSigFile} does not verify with $keyId")
    }
    if (whole(json.opt(SCHEMA)) != rules.schemaVersion.toLong()) fail("is not schema ${rules.schemaVersion}")
    val host = json.optJSONObject(HOST) ?: fail("names no host")
    val versionCode = whole(host.opt(VERSION_CODE)) ?: fail("has no host versionCode")
    if (versionCode != hostVersionCode) {
      reject(ToolRejection.OTHER_RELEASE, "${rules.indexFile} is for versionCode $versionCode, this build is $hostVersionCode")
    }
    val versionName = text(host.opt(VERSION_NAME), rules.semver) ?: fail("has no host versionName")
    val tools = json.optJSONArray(TOOLS) ?: fail("has no tools list")
    val entries = (0 until tools.length()).map { entry(tools.opt(it)) ?: fail("tools entry $it is malformed") }
    if (entries.map { it.id }.toSet().size != entries.size) fail("lists a tool twice")
    return ToolIndex(versionName, entries)
  }

  private fun parse(bytes: ByteArray): JSONObject =
    try {
      JSONObject(String(bytes, Charsets.UTF_8))
    } catch (error: JSONException) {
      fail("is not a JSON object")
    }

  private fun signingKeyId(json: JSONObject): String {
    val signature = json.optJSONObject(SIGNATURE)
    if (signature == null || signature.opt(ALG) != rules.signatureAlg) fail("signature must be { alg: ${rules.signatureAlg}, keyId }")
    return text(signature.opt(KEY_ID), rules.keyId) ?: fail("signature has no keyId")
  }

  private fun entry(value: Any?): ToolIndexEntry? {
    val fields = value as? JSONObject ?: return null
    val size = whole(fields.opt(SIZE))?.takeIf { it in 1..rules.inflatedMaxBytes } ?: return null
    val summary = if (fields.has(SUMMARY)) text(fields.opt(SUMMARY), max = rules.summaryMax) ?: return null else null
    return ToolIndexEntry(
      id = text(fields.opt(ID), rules.id) ?: return null,
      version = text(fields.opt(VERSION), rules.semver) ?: return null,
      name = text(fields.opt(NAME), max = rules.nameMax) ?: return null,
      icon = text(fields.opt(ICON)) ?: return null,
      summary = summary,
      asset = text(fields.opt(ASSET))?.takeIf(::isSinglePathSegment) ?: return null,
      size = size,
      kbtSha256 = text(fields.opt(KBT_SHA256), rules.sha256) ?: return null,
      manifestSha256 = text(fields.opt(MANIFEST_SHA256), rules.sha256) ?: return null,
      capabilities = textList(fields.opt(CAPABILITIES)) ?: return null,
    )
  }

  private fun isSinglePathSegment(asset: String): Boolean =
    asset.endsWith(rules.kbtExtension) && !asset.startsWith(".") &&
      asset.none { it == '/' || it == '\\' || it.isWhitespace() || it.isISOControl() }

  private fun text(value: Any?, pattern: Regex? = null, max: Int? = null): String? =
    (value as? String)?.takeIf { (pattern == null || pattern.matches(it)) && (max == null || it.length <= max) }

  private fun textList(value: Any?): List<String>? {
    val array = value as? JSONArray ?: return null
    val items = (0 until array.length()).map { array.opt(it) }
    return if (items.all { it is String }) items.map { it as String } else null
  }

  private fun whole(value: Any?): Long? = when (value) {
    is Int -> value.toLong()
    is Long -> value
    else -> null
  }

  private fun fail(problem: String): Nothing = reject(ToolRejection.INDEX, "${rules.indexFile} $problem")

  private companion object {
    const val SCHEMA = "schema"
    const val HOST = "host"
    const val VERSION_CODE = "versionCode"
    const val VERSION_NAME = "versionName"
    const val TOOLS = "tools"
    const val SIGNATURE = "signature"
    const val ALG = "alg"
    const val KEY_ID = "keyId"
    const val ID = "id"
    const val VERSION = "version"
    const val NAME = "name"
    const val ICON = "icon"
    const val SUMMARY = "summary"
    const val ASSET = "asset"
    const val SIZE = "size"
    const val KBT_SHA256 = "kbtSha256"
    const val MANIFEST_SHA256 = "manifestSha256"
    const val CAPABILITIES = "capabilities"
  }
}
