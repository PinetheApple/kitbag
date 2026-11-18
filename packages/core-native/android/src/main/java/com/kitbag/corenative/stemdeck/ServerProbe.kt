package com.kitbag.corenative.stemdeck

class ProbeResult(
  val trust: String,
  val fingerprint: String?,
  val previousFingerprint: String?,
  val health: HttpText?,
)

class ServerProbe(private val http: () -> StemDeckHttp, private val servers: ServerStore) {
  fun probe(origin: ServerOrigin): ProbeResult = if (origin.secure) secure(origin) else plain(origin)

  private fun plain(origin: ServerOrigin): ProbeResult {
    val health = health(origin, TrustPolicy.System)
    servers.probed(origin, null, systemVerified = false)
    return ProbeResult(TRUST_PLAIN, null, null, health)
  }

  private fun secure(origin: ServerOrigin): ProbeResult {
    val known = servers.find(origin.canonical)
    known?.fingerprint?.let { pin -> return pinned(origin, pin) }
    val probe = TrustPolicy.Probe()
    val health = health(origin, probe)
    val fingerprint = probe.presented ?: throw StemDeckException(StemDeckFailure.TLS_FAILED)
    servers.probed(origin, fingerprint, probe.systemVerified)
    val trust = when {
      probe.systemVerified -> TRUST_SYSTEM
      known != null -> TRUST_CHANGED
      else -> TRUST_NEW
    }
    return ProbeResult(trust, fingerprint, null, health)
  }

  private fun pinned(origin: ServerOrigin, pin: String): ProbeResult =
    try {
      ProbeResult(TRUST_PINNED, pin, null, health(origin, TrustPolicy.Pinned(pin)))
    } catch (e: StemDeckException) {
      val presented = e.presentedFingerprint
      if (e.code != StemDeckFailure.CERTIFICATE_CHANGED || presented == null) throw e
      servers.probed(origin, presented, systemVerified = false)
      ProbeResult(TRUST_CHANGED, presented, pin, null)
    }

  private fun health(origin: ServerOrigin, policy: TrustPolicy) =
    http().text(origin, StemDeckApi.HEALTH_PATH, policy, HEALTH_CAP_BYTES)

  companion object {
    const val TRUST_PINNED = "pinned"
    const val TRUST_SYSTEM = "system"
    const val TRUST_NEW = "new"
    const val TRUST_CHANGED = "changed"
    const val TRUST_PLAIN = "plain"
    private const val HEALTH_CAP_BYTES = 64 * 1024

    val CONSTANTS: Map<String, Any> = mapOf(
      "trustPinned" to TRUST_PINNED,
      "trustSystem" to TRUST_SYSTEM,
      "trustNew" to TRUST_NEW,
      "trustChanged" to TRUST_CHANGED,
      "trustPlain" to TRUST_PLAIN,
    )
  }
}
