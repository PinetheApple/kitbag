package com.kitbag.corenative.tools

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import org.json.JSONTokener
import kotlin.math.abs
import kotlin.math.floor

internal class ToolManifestFile(val path: String, val sha256: String, val size: Long)

internal class ToolManifest(
  val id: String,
  val version: String,
  val bytecodeVersion: Int,
  val files: List<ToolManifestFile>,
  val minVersionCode: Long,
  val maxVersionCode: Long?,
  val hostApiMajor: Long,
  val hostApiMinMinor: Long,
)

internal class ToolManifestParser(private val rules: ToolBundleRules) {
  private class Problems {
    val list = mutableListOf<String>()

    fun check(ok: Boolean, problem: String): Boolean {
      if (!ok) list += problem
      return ok
    }

    fun add(problem: String) {
      list += problem
    }
  }

  fun parse(bytes: ByteArray): JSONObject {
    val text = String(bytes, Charsets.UTF_8)
    val value = try {
      duplicateKey(text)?.let { reject(ToolRejection.MANIFEST, "${rules.manifestFile} repeats the key $it") }
      val tokener = JSONTokener(text)
      tokener.nextValue().also {
        if (tokener.nextClean() != END_OF_TEXT) reject(ToolRejection.MANIFEST, "${rules.manifestFile} has text after its object")
      }
    } catch (error: JSONException) {
      reject(ToolRejection.MANIFEST, "${rules.manifestFile} is not JSON")
    } catch (error: StackOverflowError) {
      reject(ToolRejection.MANIFEST, "${rules.manifestFile} nests too deeply")
    }
    return value as? JSONObject ?: reject(ToolRejection.MANIFEST, "manifest is not a JSON object")
  }

  // org.json keeps the last of two equal keys on Android and throws on the JVM; refuse both the same way.
  private fun duplicateKey(text: String): String? {
    val objects = ArrayDeque<MutableSet<String>?>()
    var expectingKey = false
    var at = 0
    while (at < text.length) {
      when (text[at]) {
        '{' -> {
          objects.addLast(mutableSetOf())
          expectingKey = true
        }
        '[' -> {
          objects.addLast(null)
          expectingKey = false
        }
        '}', ']' -> {
          objects.removeLastOrNull()
          expectingKey = false
        }
        ',' -> expectingKey = objects.lastOrNull() != null
        '"' -> {
          val end = stringEnd(text, at)
          if (expectingKey) {
            val key = JSONTokener(text.substring(at, end + 1)).nextValue() as String
            if (objects.last()?.add(key) == false) return key
            expectingKey = false
          }
          at = end
        }
      }
      at++
    }
    return null
  }

  private fun stringEnd(text: String, start: Int): Int {
    var at = start + 1
    while (at < text.length && text[at] != '"') at += if (text[at] == '\\') 2 else 1
    if (at >= text.length) throw JSONException("unterminated string")
    return at
  }

  fun signingKeyId(manifest: JSONObject): String {
    val signature = manifest.optJSONObject(SIGNATURE)
    val ok = signature != null &&
      signature.opt(ALG) == rules.signatureAlg &&
      isText(signature.opt(KEY_ID), rules.keyId)
    if (!ok) reject(ToolRejection.MANIFEST, "signature must be { alg: ${rules.signatureAlg}, keyId }")
    return signature!!.getString(KEY_ID)
  }

  fun validate(m: JSONObject): ToolManifest {
    val problems = Problems()
    for (key in m.keys()) problems.check(key in rules.manifestFields, "unknown manifest field $key")
    checkIdentity(m, problems)
    checkCompatibility(m, problems)
    checkRoutes(m, problems)
    problems.check(m.opt(ENTRY) == rules.entryFile, "entry must be ${rules.entryFile}")
    val files = checkFiles(m.opt(FILES), problems)
    problems.check(files == null || sizeIsSumOfFiles(m.opt(SIZE), files), "size is not the sum of files[].size")
    if (problems.list.isNotEmpty()) reject(ToolRejection.MANIFEST, problems.list.joinToString("; "))
    val bytecodeVersion = asLong(m.getJSONObject(RUNTIME).get(rules.bytecodeVersionField))
    if (bytecodeVersion > Int.MAX_VALUE) reject(ToolRejection.MANIFEST, "runtime.${rules.bytecodeVersionField} is out of range")
    val host = m.getJSONObject(HOST)
    val maxVersionCode = if (host.isNull(MAX_VERSION_CODE)) null else asLong(host.get(MAX_VERSION_CODE))
    val hostApi = m.getJSONObject(HOST_API)
    return ToolManifest(
      id = m.getString(ID),
      version = m.getString(VERSION),
      bytecodeVersion = bytecodeVersion.toInt(),
      files = files!!,
      minVersionCode = asLong(host.get(MIN_VERSION_CODE)),
      maxVersionCode = maxVersionCode,
      hostApiMajor = asLong(hostApi.get(MAJOR)),
      hostApiMinMinor = asLong(hostApi.get(MIN_MINOR)),
    )
  }

  private fun sizeIsSumOfFiles(size: Any?, files: List<ToolManifestFile>): Boolean =
    isInt(size) && asLong(size) == files.sumOf { it.size }

  private fun checkIdentity(m: JSONObject, problems: Problems) {
    problems.check(m.opt(SCHEMA).let { isInt(it) && asLong(it) == rules.schemaVersion.toLong() }, "schema must be ${rules.schemaVersion}")
    problems.check(isText(m.opt(ID), rules.id), "id is not a tool id")
    problems.check(isText(m.opt(NAME), max = rules.nameMax), "name must be text of at most ${rules.nameMax}")
    problems.check(isText(m.opt(VERSION), rules.semver), "version is not semver")
    problems.check(isText(m.opt(ICON)), "icon must be text")
    problems.check(optional(m, SUMMARY) { isText(it, max = rules.summaryMax) }, "summary is too long")
    problems.check(optional(m, CHANGELOG) { isText(it, max = rules.changelogMax) }, "changelog is too long")
    problems.check(isTextList(m.opt(CAPABILITIES)), "capabilities must be a list of names")
    problems.check(
      optional(m, REQUIRES) { requires ->
        val ids = textList(requires, rules.id)
        ids != null && ids.toSet().size == ids.size && ids.none { it == m.opt(ID) }
      },
      "requires must list other tool ids once each",
    )
  }

  private fun checkCompatibility(m: JSONObject, problems: Problems) {
    val hostApi = m.optJSONObject(HOST_API)
    problems.check(
      hostApi != null && isInt(hostApi.opt(MAJOR), 0) && isInt(hostApi.opt(MIN_MINOR), 0),
      "hostApi needs integer major and minMinor",
    )
    val host = m.optJSONObject(HOST)
    problems.check(
      host != null &&
        isInt(host.opt(MIN_VERSION_CODE), 0) &&
        host.has(MAX_VERSION_CODE) &&
        (host.isNull(MAX_VERSION_CODE) || isInt(host.opt(MAX_VERSION_CODE), 0)) &&
        isText(host.opt(BUILT_WITH), rules.semver),
      "host needs minVersionCode, maxVersionCode and builtWith",
    )
    val runtime = m.optJSONObject(RUNTIME)
    problems.check(
      runtime != null && isInt(runtime.opt(rules.bytecodeVersionField), 0) &&
        rules.runtimePackageFields.all { isText(runtime.opt(it)) },
      "runtime needs the bytecode version and the React Native, React, Reanimated and worklets versions",
    )
  }

  private fun checkRoutes(m: JSONObject, problems: Problems) {
    val prefix = "${rules.routePrefix}${m.opt(ID)}"
    val routes = textList(m.opt(ROUTES), rules.route)
    if (!problems.check(!routes.isNullOrEmpty(), "routes must hold at least one ${rules.routePrefix} route")) return
    for (route in routes!!) {
      problems.check(route == prefix || route.startsWith("$prefix/"), "route $route is outside $prefix")
    }
    if (!m.has(HOME_TILE)) return
    val tile = m.optJSONObject(HOME_TILE)
    problems.check(
      tile != null && isText(tile.opt(LABEL), max = rules.labelMax) && routes.any { it == tile.opt(ROUTE) },
      "homeTile needs a label and a route from routes",
    )
  }

  private fun checkFiles(value: Any?, problems: Problems): List<ToolManifestFile>? {
    if (!problems.check(value is JSONArray && value.length() > 0, "files must list at least one file")) return null
    val array = value as JSONArray
    val files = mutableListOf<ToolManifestFile>()
    for (index in 0 until array.length()) {
      val file = manifestFile(array.opt(index))
      if (file == null) {
        problems.add("files entry $index is malformed")
        continue
      }
      problems.check(files.none { it.path == file.path }, "files lists ${file.path} twice")
      files += file
    }
    problems.check(files.any { it.path == rules.entryFile }, "files must list ${rules.entryFile}")
    return if (files.size == array.length()) files else null
  }

  private fun manifestFile(value: Any?): ToolManifestFile? {
    val file = value as? JSONObject ?: return null
    val ok = isText(file.opt(PATH), rules.filePath) && isText(file.opt(SHA256), rules.sha256) && isInt(file.opt(SIZE), 0)
    return if (ok) ToolManifestFile(file.getString(PATH), file.getString(SHA256), asLong(file.get(SIZE))) else null
  }

  private fun optional(m: JSONObject, key: String, check: (Any?) -> Boolean): Boolean = !m.has(key) || check(m.opt(key))

  private fun isText(value: Any?, pattern: Regex? = null, max: Int? = null): Boolean =
    value is String && (pattern == null || pattern.matches(value)) && (max == null || value.length <= max)

  private fun textList(value: Any?, pattern: Regex? = null): List<String>? {
    val array = value as? JSONArray ?: return null
    val items = (0 until array.length()).map { array.opt(it) }
    return if (items.all { isText(it, pattern) }) items.map { it as String } else null
  }

  private fun isTextList(value: Any?): Boolean = textList(value) != null

  private fun isInt(value: Any?, min: Long = -MAX_SAFE_INTEGER): Boolean {
    if (value !is Number) return false
    val number = value.toDouble()
    return number.isFinite() && number == floor(number) && abs(number) <= MAX_SAFE_INTEGER && number >= min
  }

  private fun asLong(value: Any?): Long = (value as Number).toDouble().toLong()

  private companion object {
    const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L
    const val END_OF_TEXT = 0.toChar()
    const val SCHEMA = "schema"
    const val ID = "id"
    const val NAME = "name"
    const val VERSION = "version"
    const val ICON = "icon"
    const val SUMMARY = "summary"
    const val CHANGELOG = "changelog"
    const val CAPABILITIES = "capabilities"
    const val REQUIRES = "requires"
    const val HOST_API = "hostApi"
    const val MAJOR = "major"
    const val MIN_MINOR = "minMinor"
    const val HOST = "host"
    const val MIN_VERSION_CODE = "minVersionCode"
    const val MAX_VERSION_CODE = "maxVersionCode"
    const val BUILT_WITH = "builtWith"
    const val RUNTIME = "runtime"
    const val ROUTES = "routes"
    const val HOME_TILE = "homeTile"
    const val LABEL = "label"
    const val ROUTE = "route"
    const val ENTRY = "entry"
    const val FILES = "files"
    const val SIZE = "size"
    const val PATH = "path"
    const val SHA256 = "sha256"
    const val SIGNATURE = "signature"
    const val ALG = "alg"
    const val KEY_ID = "keyId"
  }
}
