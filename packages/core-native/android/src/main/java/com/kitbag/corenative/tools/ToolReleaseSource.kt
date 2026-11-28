package com.kitbag.corenative.tools

import java.net.URI
import java.net.URISyntaxException
import java.net.URL

internal class ToolReleaseSource(private val rules: ToolBundleRules) {
  init {
    val segments = rules.releaseRepo.split(SEPARATOR)
    val ok = rules.releaseHost.isNotEmpty() && rules.releaseHost.none { it in HOST_BREAKERS } &&
      segments.size == REPO_SEGMENTS && segments.all { it.isNotEmpty() && it != "." && it != ".." }
    if (!ok) reject(ToolRejection.INTERNAL, "${rules.releaseHost}/${rules.releaseRepo} is not a release source")
  }

  fun kbtUrl(versionName: String, asset: String): URL {
    val path = "/${rules.releaseRepo}/${rules.releaseDownloadPath}/${rules.releaseTagPrefix}$versionName/$asset"
    return try {
      URI(HTTPS_SCHEME, rules.releaseHost, path, null).toURL()
    } catch (error: URISyntaxException) {
      reject(ToolRejection.INTERNAL, "no release URL for $asset", error)
    }
  }

  private companion object {
    const val SEPARATOR = '/'
    const val REPO_SEGMENTS = 2
    val HOST_BREAKERS = setOf('/', ':', '@', '?', '#', '\\')
  }
}
