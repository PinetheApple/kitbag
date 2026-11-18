package com.kitbag.corenative.stemdeck

import com.kitbag.corenative.library.readCapped
import java.io.ByteArrayInputStream
import java.io.Closeable
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetAddress
import java.net.Proxy
import java.net.UnknownHostException
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection

class HttpText(val status: Int, val contentType: String, val body: String)

class StemDeckResponse(private val connection: HttpURLConnection, val request: StemDeckRequest) : Closeable {
  val status: Int = connection.responseCode

  val contentType: String get() = connection.contentType.orEmpty()

  val contentLength: Long get() = connection.contentLengthLong

  fun body(): InputStream =
    if (status == HttpURLConnection.HTTP_OK) connection.inputStream
    else connection.errorStream ?: ByteArrayInputStream(ByteArray(0))

  fun failureText(capBytes: Int): String = readCapped(body(), capBytes).orEmpty()

  override fun close() = connection.disconnect()
}

class StemDeckHttp(
  private val tls: TlsContexts,
  private val allowsPlain: (InetAddress) -> Boolean = LocalAddressGuard::allows,
  private val resolve: (String) -> Array<InetAddress> = InetAddress::getAllByName,
  private val defaultVerifier: HostnameVerifier = HttpsURLConnection.getDefaultHostnameVerifier(),
  private val connectTimeoutMillis: Int = CONNECT_TIMEOUT_MILLIS,
) {
  // Connects and waits for the status line. `watch` gets the request first, so another thread can abort it.
  fun open(
    origin: ServerOrigin,
    pathAndQuery: String,
    policy: TrustPolicy,
    readTimeoutMillis: Int,
    watch: (StemDeckRequest) -> Unit = {},
  ): StemDeckResponse {
    val target = if (origin.secure) origin else resolvedPlain(origin)
    val connection = target.url(pathAndQuery).openConnection(Proxy.NO_PROXY) as HttpURLConnection
    connection.instanceFollowRedirects = false
    connection.useCaches = false
    connection.connectTimeout = connectTimeoutMillis
    connection.readTimeout = readTimeoutMillis
    connection.setRequestProperty(ACCEPT_ENCODING, IDENTITY)
    val request = StemDeckRequest(connection)
    if (connection is HttpsURLConnection) {
      connection.sslSocketFactory = request.track(tls.factory(origin, policy))
      connection.hostnameVerifier = PolicyHostnameVerifier(defaultVerifier, policy)
    }
    watch(request)
    try {
      return StemDeckResponse(connection, request)
    } catch (e: IOException) {
      connection.disconnect()
      val changed = generateSequence<Throwable>(e) { it.cause }.filterIsInstance<CertificateChangedException>().firstOrNull()
      if (changed != null) throw StemDeckException(StemDeckFailure.CERTIFICATE_CHANGED, e, changed.presented)
      throw e
    }
  }

  fun text(origin: ServerOrigin, pathAndQuery: String, policy: TrustPolicy, capBytes: Int): HttpText =
    open(origin, pathAndQuery, policy, TEXT_READ_TIMEOUT_MILLIS).use { response ->
      if (response.status != HttpURLConnection.HTTP_OK) throw failure(response)
      val body = readCapped(response.body(), capBytes) ?: throw StemDeckException(StemDeckFailure.TOO_LARGE)
      HttpText(response.status, response.contentType, body)
    }

  fun failure(response: StemDeckResponse): StemDeckException =
    StemDeckException(StemDeckFailure.ofFailedStatus(response.status, response.failureText(FAILURE_TEXT_BYTES)))

  // Connecting to the checked address itself leaves no second lookup to answer differently.
  private fun resolvedPlain(origin: ServerOrigin): ServerOrigin {
    if (!LocalAddressGuard.allowsHost(origin.host)) throw StemDeckException(StemDeckFailure.HTTP_NOT_LOCAL)
    val addresses = try {
      resolve(origin.host)
    } catch (e: UnknownHostException) {
      throw StemDeckException(StemDeckFailure.UNREACHABLE, e)
    }
    if (addresses.isEmpty() || !addresses.all(allowsPlain)) throw StemDeckException(StemDeckFailure.HTTP_NOT_LOCAL)
    // A .local name can resolve to a scoped fe80:: address that a URL cannot carry; IPv4 is preferred.
    val address = addresses.firstOrNull { it is Inet4Address } ?: addresses.first()
    return origin.withHost(address.hostAddress ?: throw StemDeckException(StemDeckFailure.BAD_ADDRESS))
  }

  companion object {
    const val CONNECT_TIMEOUT_MILLIS = 10_000
    const val TEXT_READ_TIMEOUT_MILLIS = 30_000
    const val FAILURE_TEXT_BYTES = 4096
    private const val ACCEPT_ENCODING = "Accept-Encoding"
    private const val IDENTITY = "identity"
  }
}

object StemDeckApi {
  const val HEALTH_PATH = "/api/health"
  const val JOBS_PATH = "/api/jobs"
  const val SETLISTS_PATH = "/api/setlists"
  private const val BUNDLE_SUFFIX = "/bundle.zip"
  private const val STEMS_QUERY = "?stems="
  private const val STEM_SEPARATOR = ","

  const val ENDPOINT_HEALTH = "health"
  const val ENDPOINT_JOBS = "jobs"
  const val ENDPOINT_SETLISTS = "setlists"

  val ENDPOINTS = mapOf(ENDPOINT_HEALTH to HEALTH_PATH, ENDPOINT_JOBS to JOBS_PATH, ENDPOINT_SETLISTS to SETLISTS_PATH)

  val CONSTANTS: Map<String, Any> = mapOf(
    "endpointHealth" to ENDPOINT_HEALTH,
    "endpointJobs" to ENDPOINT_JOBS,
    "endpointSetlists" to ENDPOINT_SETLISTS,
  )

  // Only the lanes go out: StemDeck keeps the mix in its own UI, so a fetched song starts at unity.
  fun bundlePath(item: ImportItem): String {
    val path = "$JOBS_PATH/${item.jobId}$BUNDLE_SUFFIX"
    return if (item.stems.isEmpty()) path else path + STEMS_QUERY + item.stems.joinToString(STEM_SEPARATOR)
  }
}
