package com.kitbag.corenative.stemdeck

import com.kitbag.corenative.library.DataFolderUnavailableException
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import javax.net.ssl.SSLException

class StemDeckException(
  val code: String,
  cause: Throwable? = null,
  val presentedFingerprint: String? = null,
) : IOException(code, cause)

object StemDeckFailure {
  const val BAD_ADDRESS = "badAddress"
  const val UNREACHABLE = "unreachable"
  const val TIMED_OUT = "timedOut"
  const val CERTIFICATE_CHANGED = "certificateChanged"
  const val TLS_FAILED = "tlsFailed"
  const val NETWORK_OFF = "networkOff"
  const val NEEDS_HTTPS = "needsHttps"
  const val HTTP_NOT_LOCAL = "httpNotLocal"
  const val NOT_FOUND = "notFound"
  const val HTTP_ERROR = "httpError"
  const val TOO_LARGE = "tooLarge"
  const val NO_SPACE = "noSpace"
  const val LIBRARY_UNAVAILABLE = "libraryUnavailable"
  const val DROPPED = "dropped"
  const val CANCELLED = "cancelled"
  const val INTERRUPTED = "interrupted"
  const val TIME_LIMIT = "timeLimit"
  const val REFUSED = "refused"
  const val ADD_FAILED = "addFailed"
  const val NOT_ADDED = "notAdded"

  // StemDeck answers both 403s as text/plain; these are fragments of its messages.
  private const val NETWORK_OFF_TEXT = "not available on the network"
  private const val NEEDS_HTTPS_TEXT = "needs an https://"

  private val ONE_SONG = setOf(NOT_FOUND, HTTP_ERROR, TOO_LARGE, REFUSED, ADD_FAILED, NOT_ADDED)

  val CONSTANTS: Map<String, Any> = mapOf(
    "failureBadAddress" to BAD_ADDRESS,
    "failureUnreachable" to UNREACHABLE,
    "failureTimedOut" to TIMED_OUT,
    "failureCertificateChanged" to CERTIFICATE_CHANGED,
    "failureTlsFailed" to TLS_FAILED,
    "failureNetworkOff" to NETWORK_OFF,
    "failureNeedsHttps" to NEEDS_HTTPS,
    "failureHttpNotLocal" to HTTP_NOT_LOCAL,
    "failureNotFound" to NOT_FOUND,
    "failureHttpError" to HTTP_ERROR,
    "failureTooLarge" to TOO_LARGE,
    "failureNoSpace" to NO_SPACE,
    "failureLibraryUnavailable" to LIBRARY_UNAVAILABLE,
    "failureDropped" to DROPPED,
    "failureCancelled" to CANCELLED,
    "failureInterrupted" to INTERRUPTED,
    "failureTimeLimit" to TIME_LIMIT,
    "failureRefused" to REFUSED,
    "failureAddFailed" to ADD_FAILED,
    "failureNotAdded" to NOT_ADDED,
  )

  fun ofFailedStatus(status: Int, body: String): String =
    when {
      status == HttpURLConnection.HTTP_FORBIDDEN && body.contains(NETWORK_OFF_TEXT, ignoreCase = true) -> NETWORK_OFF
      status == HttpURLConnection.HTTP_FORBIDDEN && body.contains(NEEDS_HTTPS_TEXT, ignoreCase = true) -> NEEDS_HTTPS
      status == HttpURLConnection.HTTP_NOT_FOUND -> NOT_FOUND
      else -> HTTP_ERROR
    }

  fun of(error: Throwable, headersReceived: Boolean): String {
    val chain = generateSequence(error) { it.cause }.toList()
    chain.firstNotNullOfOrNull { (it as? StemDeckException)?.code }?.let { return it }
    if (chain.any { it is CertificateChangedException }) return CERTIFICATE_CHANGED
    if (chain.any { it is DataFolderUnavailableException }) return LIBRARY_UNAVAILABLE
    return when {
      headersReceived -> DROPPED
      chain.any { it is SSLException } -> TLS_FAILED
      chain.any { it is SocketTimeoutException } -> TIMED_OUT
      else -> UNREACHABLE
    }
  }

  fun stopsQueue(code: String): Boolean = code !in ONE_SONG
}
