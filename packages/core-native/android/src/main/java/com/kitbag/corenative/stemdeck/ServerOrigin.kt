package com.kitbag.corenative.stemdeck

import java.net.URI
import java.net.URISyntaxException
import java.net.URL

data class ServerOrigin(val scheme: String, val host: String, val port: Int) {
  val secure: Boolean get() = scheme == HTTPS

  val canonical: String get() = "$scheme://${bracketed(host)}:$port"

  fun url(pathAndQuery: String): URL = URL("$canonical$pathAndQuery")

  fun withHost(address: String) = copy(host = address)

  companion object {
    const val HTTPS = "https"
    const val HTTP = "http"
    private const val HTTPS_PORT = 443
    private const val HTTP_PORT = 80
    private const val NO_PORT = -1
    private val PORTS = 1..65535
    private const val ROOT_PATH = "/"

    fun parse(text: String): ServerOrigin? {
      val uri = try {
        URI(text.trim())
      } catch (e: URISyntaxException) {
        return null
      }
      val scheme = uri.scheme?.lowercase()?.takeIf { it == HTTP || it == HTTPS } ?: return null
      val host = uri.host?.removePrefix("[")?.removeSuffix("]")?.lowercase()?.takeIf { it.isNotEmpty() }
        ?: return null
      if (uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null) return null
      if (!uri.rawPath.isNullOrEmpty() && uri.rawPath != ROOT_PATH) return null
      val port = if (uri.port == NO_PORT) defaultPort(scheme) else uri.port
      return if (port in PORTS) ServerOrigin(scheme, host, port) else null
    }

    private fun defaultPort(scheme: String) = if (scheme == HTTPS) HTTPS_PORT else HTTP_PORT

    private fun bracketed(host: String) = if (host.contains(':')) "[$host]" else host
  }
}
