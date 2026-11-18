package com.kitbag.corenative.stemdeck

import java.io.File
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

data class KnownServer(
  val origin: String,
  val fingerprint: String?,
  val trustedAt: Long,
  val lastUsedAt: Long,
  val plain: Boolean,
)

class ServerStore(private val file: File, private val now: () -> Long) {
  private class Probed(val fingerprint: String?, val systemVerified: Boolean)

  private val probed = mutableMapOf<String, Probed>()

  @Synchronized fun all(): List<KnownServer> = read()

  @Synchronized fun find(origin: String): KnownServer? = read().firstOrNull { it.origin == origin }

  @Synchronized
  fun probed(origin: ServerOrigin, fingerprint: String?, systemVerified: Boolean) {
    probed[origin.canonical] = Probed(fingerprint, systemVerified)
  }

  // Only what the last probe of this origin saw can be trusted, so a stale or invented fingerprint is refused.
  @Synchronized
  fun trust(origin: ServerOrigin, fingerprint: String?): Boolean {
    val seen = probed[origin.canonical] ?: return false
    val accepted = when {
      !origin.secure -> fingerprint == null
      fingerprint == null -> seen.systemVerified
      else -> seen.fingerprint?.let { CertFingerprint.same(it, fingerprint) } ?: false
    }
    if (!accepted) return false
    probed.remove(origin.canonical)
    val time = now()
    val pin = fingerprint?.lowercase()
    write(read().filter { it.origin != origin.canonical } + KnownServer(origin.canonical, pin, time, time, !origin.secure))
    return true
  }

  @Synchronized
  fun touch(origin: ServerOrigin) {
    val servers = read()
    if (servers.none { it.origin == origin.canonical }) return
    val time = now()
    write(servers.map { if (it.origin == origin.canonical) it.copy(lastUsedAt = time) else it })
  }

  @Synchronized
  fun forget(origin: ServerOrigin) {
    probed.remove(origin.canonical)
    write(read().filter { it.origin != origin.canonical })
  }

  @Synchronized
  fun policy(origin: ServerOrigin): TrustPolicy =
    find(origin.canonical)?.fingerprint?.let { TrustPolicy.Pinned(it) } ?: TrustPolicy.System

  private fun read(): List<KnownServer> {
    if (!file.isFile) return emptyList()
    return try {
      val array = JSONArray(file.readText())
      (0 until array.length()).map { server(array.getJSONObject(it)) }
    } catch (e: JSONException) {
      emptyList()
    }
  }

  private fun write(servers: List<KnownServer>) =
    writeAtomically(file, JSONArray().apply { servers.forEach { put(json(it)) } }.toString())

  private fun json(server: KnownServer) =
    JSONObject()
      .put(ORIGIN, server.origin)
      .put(FINGERPRINT, server.fingerprint ?: JSONObject.NULL)
      .put(TRUSTED_AT, server.trustedAt)
      .put(LAST_USED_AT, server.lastUsedAt)
      .put(PLAIN, server.plain)

  private fun server(json: JSONObject) =
    KnownServer(
      origin = json.getString(ORIGIN),
      fingerprint = if (json.isNull(FINGERPRINT)) null else json.getString(FINGERPRINT),
      trustedAt = json.getLong(TRUSTED_AT),
      lastUsedAt = json.getLong(LAST_USED_AT),
      plain = json.getBoolean(PLAIN),
    )

  companion object {
    const val DIR_NAME = "stemdeck"
    const val FILE_NAME = "servers.json"
    private const val ORIGIN = "origin"
    private const val FINGERPRINT = "sha256"
    private const val TRUSTED_AT = "trustedAt"
    private const val LAST_USED_AT = "lastUsedAt"
    private const val PLAIN = "plain"
  }
}
