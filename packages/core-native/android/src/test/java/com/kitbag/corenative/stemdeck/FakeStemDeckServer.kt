package com.kitbag.corenative.stemdeck

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import javax.net.ssl.SSLContext
import kotlin.concurrent.thread

class FakeStemDeckServer(
  tls: SSLContext? = null,
  port: Int = 0,
  private val respond: (String, Socket) -> Unit,
) : Closeable {
  private val server: ServerSocket = (tls?.serverSocketFactory?.createServerSocket() ?: ServerSocket()).apply {
    reuseAddress = true
    bind(InetSocketAddress(LOOPBACK, port), BACKLOG)
  }
  private val scheme = if (tls == null) ServerOrigin.HTTP else ServerOrigin.HTTPS

  val requests = CopyOnWriteArrayList<String>()
  val failures = CopyOnWriteArrayList<Throwable>()
  val accepted = AtomicInteger()
  private val finished = AtomicInteger()

  val origin: ServerOrigin get() = ServerOrigin(scheme, LOOPBACK.hostAddress, server.localPort)

  init {
    thread(isDaemon = true, name = "fake-stemdeck") { acceptLoop() }
  }

  private fun acceptLoop() {
    while (!server.isClosed) {
      val socket = try {
        server.accept()
      } catch (e: IOException) {
        return
      }
      accepted.incrementAndGet()
      thread(isDaemon = true) { handle(socket) }
    }
  }

  private fun handle(socket: Socket) {
    try {
      socket.use {
        val head = readHead(it.getInputStream())
        requests.add(head.lineSequence().first())
        respond(head, it)
      }
    } catch (e: IOException) {
      failures.add(e)
    } finally {
      finished.incrementAndGet()
    }
  }

  fun awaitHandled(count: Int = accepted.get()) {
    val deadline = System.currentTimeMillis() + WAIT_MILLIS
    while (finished.get() < count && System.currentTimeMillis() < deadline) Thread.sleep(POLL_MILLIS)
  }

  override fun close() = server.close()

  companion object {
    private const val BACKLOG = 8
    private const val WAIT_MILLIS = 5000L
    private const val POLL_MILLIS = 10L
    val LOOPBACK: InetAddress = InetAddress.getByName("127.0.0.1")

    // Read byte by byte so nothing past the head is consumed.
    private fun readHead(input: InputStream): String {
      val head = ByteArrayOutputStream()
      var tail = 0
      while (tail != END_OF_HEAD) {
        val b = input.read()
        if (b < 0) throw IOException("Request ended early")
        head.write(b)
        tail = (tail shl 8) or b
      }
      return head.toString(Charsets.ISO_8859_1.name())
    }

    private const val END_OF_HEAD = 0x0d0a0d0a

    fun reply(
      socket: Socket,
      status: Int,
      body: ByteArray,
      contentType: String = "application/json",
      headers: Map<String, String> = emptyMap(),
      sendBytes: Int = body.size,
      contentLength: Long? = body.size.toLong(),
    ) {
      val out = socket.getOutputStream()
      val head = buildString {
        append("HTTP/1.1 $status X\r\n")
        append("Content-Type: $contentType\r\n")
        contentLength?.let { append("Content-Length: $it\r\n") }
        headers.forEach { (name, value) -> append("$name: $value\r\n") }
        append("Connection: close\r\n\r\n")
      }
      out.write(head.toByteArray(Charsets.ISO_8859_1))
      out.write(body, 0, sendBytes)
      out.flush()
    }
  }
}
