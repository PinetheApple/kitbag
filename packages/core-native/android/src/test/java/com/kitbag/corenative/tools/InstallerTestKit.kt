package com.kitbag.corenative.tools

import com.kitbag.corenative.library.JsonStateFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Collections
import java.util.concurrent.CountDownLatch

internal class FakeResponse(
  val status: Int = HttpURLConnection.HTTP_OK,
  val body: ByteArray = ByteArray(0),
  val location: String? = null,
  val contentLength: Long = body.size.toLong(),
  val connectError: IOException? = null,
  val stream: () -> InputStream = { ByteArrayInputStream(body) },
)

internal class FakeConnector(private val respond: (URL) -> FakeResponse) : ToolConnector {
  val opened: MutableList<URL> = Collections.synchronizedList(mutableListOf())

  override fun open(url: URL): HttpURLConnection {
    opened += url
    return FakeConnection(url, respond(url))
  }
}

internal class FakeConnection(url: URL, private val response: FakeResponse) : HttpURLConnection(url) {
  var bodyRead = false

  override fun connect() = Unit

  override fun disconnect() = Unit

  override fun usingProxy() = false

  override fun getResponseCode(): Int {
    response.connectError?.let { throw it }
    return response.status
  }

  override fun getHeaderField(name: String): String? = if (name == LOCATION) response.location else null

  override fun getContentLengthLong(): Long = response.contentLength

  override fun getInputStream(): InputStream {
    bodyRead = true
    return response.stream()
  }

  private companion object {
    const val LOCATION = "Location"
  }
}

internal class DroppingStream(
  private val bytes: ByteArray,
  private val dropAt: Int,
  private val error: () -> IOException = { IOException("stream corrupt") },
) : InputStream() {
  private var at = 0

  override fun read(): Int {
    if (at >= dropAt) throw error()
    return bytes[at++].toInt() and BYTE_MASK
  }

  private companion object {
    const val BYTE_MASK = 0xff
  }
}

internal class StallingStream(private val bytes: ByteArray, private val stallAt: Int) : InputStream() {
  val stalled = CountDownLatch(1)
  private val never = CountDownLatch(1)
  private var at = 0

  override fun read(): Int {
    if (at >= stallAt) {
      stalled.countDown()
      never.await()
    }
    return bytes[at++].toInt() and BYTE_MASK
  }

  private companion object {
    const val BYTE_MASK = 0xff
  }
}

internal object TestIndex {
  const val HOST_VERSION_CODE = 10100L
  const val HOST_VERSION_NAME = "0.101.0"

  fun asset(id: String = TestTool.ID, version: String = TestTool.VERSION) = "tool-$id-$version" + RULES.kbtExtension

  fun manifestSha(kbt: ByteArray): String =
    TestTool.sha256(ToolZip.read(kbt, RULES.inflatedMaxBytes).first { it.name == RULES.manifestFile }.data)

  fun entry(kbt: ByteArray, version: String = TestTool.VERSION, id: String = TestTool.ID): JSONObject =
    JSONObject()
      .put("id", id)
      .put("version", version)
      .put("name", "Sample")
      .put("icon", id)
      .put("summary", "A sample tool")
      .put("asset", asset(id, version))
      .put("size", kbt.size)
      .put("kbtSha256", TestTool.sha256(kbt))
      .put("manifestSha256", manifestSha(kbt))
      .put("capabilities", JSONArray())

  fun json(key: TestToolKey, vararg entries: JSONObject, versionCode: Long = HOST_VERSION_CODE): JSONObject =
    JSONObject()
      .put("schema", RULES.schemaVersion)
      .put("host", JSONObject().put("versionName", HOST_VERSION_NAME).put("versionCode", versionCode))
      .put("hostApi", JSONObject().put("major", 1).put("minor", 0))
      .put("signature", JSONObject().put("alg", RULES.signatureAlg).put("keyId", key.keyId))
      .put("tools", JSONArray(entries.toList()))

  fun signed(key: TestToolKey, json: JSONObject): SignedToolIndex {
    val bytes = json.toString().toByteArray()
    return SignedToolIndex(bytes, key.sign(bytes))
  }

  fun of(key: TestToolKey, vararg entries: JSONObject): SignedToolIndex = signed(key, json(key, *entries))
}

internal fun stateIn(installed: InstalledTools): ToolInstallerState =
  ToolInstallerState(JsonStateFile(File(installed.toolsDir, ".installer.json"), "test") { _, _ -> }, RULES)

internal class RecordingListener : ToolInstallListener {
  val events: MutableList<ToolInstallEvent> = Collections.synchronizedList(mutableListOf())

  val last: ToolInstallEvent get() = events.last()

  fun stages(): List<ToolInstallStage> = events.map { it.stage }.distinct()

  override fun onEvent(event: ToolInstallEvent) {
    events += event
  }
}
