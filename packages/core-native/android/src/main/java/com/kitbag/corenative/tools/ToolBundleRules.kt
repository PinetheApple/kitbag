package com.kitbag.corenative.tools

import org.json.JSONArray
import org.json.JSONObject

internal class ToolBundleRules(json: JSONObject) {
  private val files = json.getJSONObject("files")
  private val patterns = json.getJSONObject("patterns")
  private val limits = json.getJSONObject("limits")
  private val keys = json.getJSONObject("keys")
  private val runtimeFields = json.getJSONObject("runtimeFields")
  private val pinFields = json.getJSONObject("pinFields")
  private val hostApi = json.getJSONObject("hostApi")
  private val release = json.getJSONObject("release")
  private val status = keys.getJSONObject("status")

  val schemaVersion = json.getInt("schemaVersion")
  val signatureAlg: String = json.getString("signatureAlg")
  val manifestFile: String = files.getString("manifest")
  val manifestSigFile: String = files.getString("manifestSig")
  val entryFile: String = files.getString("entry")
  val kbtExtension: String = files.getString("kbtExtension")
  val indexFile: String = files.getString("index")
  val indexSigFile: String = files.getString("indexSig")
  val keyPinsFile: String = files.getString("keyPins")

  val id = Regex(patterns.getString("id"))
  val keyId = Regex(patterns.getString("keyId"))
  val semver = Regex(patterns.getString("semver"))
  val sha256 = Regex(patterns.getString("sha256"))
  val filePath = Regex(patterns.getString("filePath"))
  val route = Regex(patterns.getString("route"))
  val routePrefix: String = json.getString("routePrefix")
  val hostApiMajor = hostApi.getInt("major")
  val hostApiMinor = hostApi.getInt("minor")
  val releaseHost: String = release.getString("host")
  val releaseRepo: String = release.getString("repo")
  val releaseDownloadPath: String = release.getString("downloadPath")
  val releaseTagPrefix: String = release.getString("tagPrefix")
  val manifestFields: Set<String> = json.getJSONArray("manifestFields").strings().toSet()
  val bytecodeVersionField: String = runtimeFields.getString("bytecodeVersion")
  val runtimePackageFields: List<String> = runtimeFields.getJSONObject("packages").keys().asSequence().toList()

  val pinSchemaField: String = pinFields.getString("schema")
  val pinKeysField: String = pinFields.getString("keys")
  val pinKeyIdField: String = pinFields.getString("keyId")
  val pinRoleField: String = pinFields.getString("role")
  val pinStatusField: String = pinFields.getString("status")
  val pinSpkiField: String = pinFields.getString("spki")

  val nameMax = limits.getInt("nameMax")
  val summaryMax = limits.getInt("summaryMax")
  val changelogMax = limits.getInt("changelogMax")
  val labelMax = limits.getInt("labelMax")
  val inflatedMaxBytes = limits.getLong("inflatedMaxBytes")

  val testKeyPrefix: String = keys.getString("testPrefix")
  val toolRole: String = keys.getString("toolRole")
  val revocationRole: String = keys.getString("revocationRole")
  val currentStatus: String = status.getString("current")
  val nextStatus: String = status.getString("next")
  val retiredStatus: String = status.getString("retired")
  val roles: Set<String> = keys.getJSONArray("roles").strings().toSet()
  val statuses: Set<String> = keys.getJSONArray("statuses").strings().toSet()
  val signingStatuses: Set<String> = keys.getJSONArray("signingStatuses").strings().toSet()
  val spkiBytes = keys.getInt("spkiBytes")

  companion object {
    val bundled: ToolBundleRules by lazy { ToolBundleRules(JSONObject(TOOL_BUNDLE_RULES_JSON)) }

    private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }
  }
}
