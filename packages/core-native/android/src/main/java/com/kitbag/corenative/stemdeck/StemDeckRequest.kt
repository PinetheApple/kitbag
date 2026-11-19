package com.kitbag.corenative.stemdeck

import java.io.IOException
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.Socket
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import kotlin.concurrent.thread

// The JVM's HttpURLConnection neither drops a blocked body read on disconnect() nor
// honours a later setReadTimeout, so a stall is cut on the socket itself.
class StemDeckRequest internal constructor(private val connection: HttpURLConnection) {
  @Volatile private var socket: Socket? = null

  @Volatile private var aborted = false

  // An abort can land before the socket exists; the socket then closes as it is made.
  internal fun track(factory: SSLSocketFactory): SSLSocketFactory =
    TrackingSocketFactory(factory) {
      socket = it
      if (aborted) closeQuietly(it)
    }

  // The stack may skip a custom verifier when its own check passes, so the probe asks the verifier itself.
  fun hostnameMatches(host: String, verifier: HostnameVerifier): Boolean {
    val session = (socket as? SSLSocket)?.session ?: return false
    return verifier.verify(host, session)
  }

  fun limitReads(millis: Int) {
    socket?.soTimeout = millis
  }

  // disconnect() can wait for a blocked read to return, so it never runs on the caller's thread.
  fun abort() {
    aborted = true
    socket?.let(::closeQuietly)
    thread(isDaemon = true, name = DISCONNECT_THREAD) { connection.disconnect() }
  }

  private fun closeQuietly(socket: Socket) {
    try {
      socket.close()
    } catch (e: IOException) {
      Unit
    }
  }

  private companion object {
    const val DISCONNECT_THREAD = "kitbag-stemdeck-abort"
  }
}

private class TrackingSocketFactory(
  private val delegate: SSLSocketFactory,
  private val created: (Socket) -> Unit,
) : SSLSocketFactory() {
  override fun getDefaultCipherSuites(): Array<String> = delegate.defaultCipherSuites

  override fun getSupportedCipherSuites(): Array<String> = delegate.supportedCipherSuites

  override fun createSocket(): Socket = track(delegate.createSocket())

  override fun createSocket(socket: Socket?, host: String?, port: Int, autoClose: Boolean): Socket =
    track(delegate.createSocket(socket, host, port, autoClose))

  override fun createSocket(host: String?, port: Int): Socket = track(delegate.createSocket(host, port))

  override fun createSocket(host: String?, port: Int, localHost: InetAddress?, localPort: Int): Socket =
    track(delegate.createSocket(host, port, localHost, localPort))

  override fun createSocket(host: InetAddress?, port: Int): Socket = track(delegate.createSocket(host, port))

  override fun createSocket(address: InetAddress?, port: Int, localAddress: InetAddress?, localPort: Int): Socket =
    track(delegate.createSocket(address, port, localAddress, localPort))

  private fun track(socket: Socket): Socket = socket.also(created)
}
