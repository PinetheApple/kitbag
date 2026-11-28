package com.kitbag.corenative.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.UnknownHostException
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class ToolInstallerTest {
  private class KeptHandOff : BytecodeHandOff {
    val bytecode = mutableListOf<ByteArray>()

    override fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int) {
      this.bytecode += bytecode
    }

    override fun drop(toolId: String) = true
  }

  private val root: File = Files.createTempDirectory("kitbag-installer").toFile().apply { deleteOnExit() }
  private val installed = InstalledTools(root, RULES)
  private val key = TestToolKey.generate("installer")
  private val ring = TestPins.ring(TestPins.tool(key, TestPins.CURRENT))
  private val state = stateIn(installed).apply { setDownloads(ToolDownloads.ON) { emptyMap() } }
  private val v1 = TestTool.signed(key)
  private val v2Bytecode = "version two".toByteArray()
  private val v2 = build("2.0.0", v2Bytecode)

  private fun build(
    version: String,
    bytecode: ByteArray = TestTool.BYTECODE,
    minVersionCode: Long = TestIndex.HOST_VERSION_CODE,
    hostApiMajor: Int = RULES.hostApiMajor,
  ): ByteArray {
    val files = listOf(ZipItem(RULES.entryFile, bytecode), TestTool.files()[1])
    val manifest = TestTool.manifest(key.keyId, files).put("version", version)
    manifest.getJSONObject("host").put("minVersionCode", minVersionCode)
    manifest.getJSONObject("hostApi").put("major", hostApiMajor)
    return TestTool.signed(key, manifest, files)
  }

  private fun serving(kbt: ByteArray) = FakeConnector { FakeResponse(body = kbt) }

  private fun installer(
    index: SignedToolIndex?,
    connector: ToolConnector,
    space: ToolSpace = ToolSpace { Long.MAX_VALUE },
    commit: (File, File) -> Boolean = File::renameTo,
    source: ToolIndexSource = ToolIndexSource { index },
  ) = ToolInstaller(
    installed = installed,
    rules = RULES,
    keys = { ring },
    index = source,
    hostVersionCode = TestIndex.HOST_VERSION_CODE,
    state = state,
    downloader = ToolDownloader(connector),
    space = space,
    retry = ToolRetry(tries = TRIES, firstBackoffMs = 0),
    commit = commit,
  )

  private fun request(allowOlder: Boolean = false) = ToolInstallRequest(TestTool.ID, allowOlder)

  private fun install(
    kbt: ByteArray,
    version: String = TestTool.VERSION,
    connector: FakeConnector = serving(kbt),
    allowOlder: Boolean = false,
    job: ToolJob = ToolJob(),
  ): RecordingListener {
    val listener = RecordingListener()
    installer(TestIndex.of(key, TestIndex.entry(kbt, version)), connector)
      .install(request(allowOlder), job, listener)
    return listener
  }

  private fun installedBytes(): ByteArray? = installed.kbtFile(TestTool.ID).takeIf { it.isFile }?.readBytes()

  private fun loadedBytecode(): ByteArray {
    val handOff = KeptHandOff()
    InstalledToolLoader(installed, RULES, { ring }, handOff).load(TestTool.ID)
    return handOff.bytecode.single()
  }

  private fun stagingEmpty() = installed.stagingDir.listFiles().isNullOrEmpty()

  @Test
  fun `installs the indexed build from its release url, atomically and loadable`() {
    val connector = serving(v1)

    val listener = install(v1, connector = connector)

    assertEquals(ToolInstallStage.INSTALLED, listener.last.stage)
    assertEquals(
      listOf(ToolInstallStage.DOWNLOADING, ToolInstallStage.CHECKING, ToolInstallStage.INSTALLING, ToolInstallStage.INSTALLED),
      listener.stages(),
    )
    assertEquals(
      "https://${RULES.releaseHost}/${RULES.releaseRepo}/${RULES.releaseDownloadPath}/" +
        "${RULES.releaseTagPrefix}${TestIndex.HOST_VERSION_NAME}/${TestIndex.asset()}",
      connector.opened.single().toString(),
    )
    assertArrayEquals(v1, installedBytes())
    assertArrayEquals(TestTool.BYTECODE, loadedBytecode())
    assertEquals(TestTool.VERSION, state.highWater(TestTool.ID)?.version)
    assertEquals(TestIndex.manifestSha(v1), state.highWater(TestTool.ID)?.manifestSha256)
    assertTrue(stagingEmpty())
  }

  @Test
  fun `makes no request at all while tool downloads are unasked or off`() {
    for (downloads in listOf(ToolDownloads.UNASKED, ToolDownloads.OFF)) {
      state.setDownloads(downloads) { emptyMap() }
      val connector = serving(v1)

      val listener = install(v1, connector = connector)

      assertEquals(ToolRejection.DOWNLOADS_OFF, listener.last.failure)
      assertTrue(connector.opened.isEmpty())
      assertNull(installedBytes())
    }
  }

  @Test
  fun `refuses an older build than the high-water mark without a request`() {
    install(v2, "2.0.0")
    val connector = serving(v1)

    val listener = install(v1, connector = connector)

    assertEquals(ToolRejection.ROLLBACK, listener.last.failure)
    assertTrue(connector.opened.isEmpty())
    assertArrayEquals(v2, installedBytes())
  }

  @Test
  fun `installs an older build when asked to, keeping the high-water mark`() {
    install(v2, "2.0.0")

    val listener = install(v1, allowOlder = true)

    assertEquals(ToolInstallStage.INSTALLED, listener.last.stage)
    assertArrayEquals(v1, installedBytes())
    assertEquals("2.0.0", state.highWater(TestTool.ID)?.version)
  }

  @Test
  fun `a download that is not the indexed build is deleted and the old build kept`() {
    install(v1)
    val listener = RecordingListener()
    val index = TestIndex.of(key, TestIndex.entry(v2, "2.0.0").put("kbtSha256", TestTool.sha256(v1)))

    installer(index, serving(v2)).install(request(), ToolJob(), listener)

    assertEquals(ToolRejection.NOT_AS_INDEXED, listener.last.failure)
    assertArrayEquals(v1, installedBytes())
    assertEquals(TestTool.VERSION, state.highWater(TestTool.ID)?.version)
    assertTrue(stagingEmpty())
  }

  @Test
  fun `a build signed by an unpinned key is refused even when the index lists it`() {
    val stranger = TestTool.signed(TestToolKey.generate("stranger"))

    val listener = install(stranger)

    assertEquals(ToolRejection.UNTRUSTED_KEY, listener.last.failure)
    assertNull(installedBytes())
    assertTrue(stagingEmpty())
  }

  @Test
  fun `a build for a newer host is incompatible`() {
    val listener = install(build(TestTool.VERSION, minVersionCode = TestIndex.HOST_VERSION_CODE + 1))

    assertEquals(ToolRejection.INCOMPATIBLE, listener.last.failure)
    assertNull(installedBytes())
  }

  @Test
  fun `not enough space reports what is needed and free without a request`() {
    val connector = serving(v1)
    val listener = RecordingListener()

    installer(TestIndex.of(key, TestIndex.entry(v1)), connector, space = ToolSpace { FREE_BYTES })
      .install(request(), ToolJob(), listener)

    assertEquals(ToolRejection.NO_SPACE, listener.last.failure)
    assertEquals(v1.size.toLong(), listener.last.neededBytes)
    assertEquals(FREE_BYTES, listener.last.freeBytes)
    assertTrue(connector.opened.isEmpty())
  }

  @Test
  fun `a dropped download is retried and then installs`() {
    var calls = 0
    val connector = FakeConnector {
      calls++
      if (calls == 1) FakeResponse(body = v1, stream = { DroppingStream(v1, v1.size / 2) }) else FakeResponse(body = v1)
    }

    val listener = install(v1, connector = connector)

    assertEquals(ToolInstallStage.INSTALLED, listener.last.stage)
    assertEquals(2, listener.events.first { it.stage == ToolInstallStage.RETRYING }.attempt)
    assertEquals(2, connector.opened.size)
    assertArrayEquals(v1, installedBytes())
  }

  @Test
  fun `a download that keeps dropping fails after the last try with the bytes received`() {
    val connector = FakeConnector { FakeResponse(body = v1, stream = { DroppingStream(v1, v1.size / 2) }) }

    val listener = install(v1, connector = connector)

    assertEquals(ToolRejection.DOWNLOAD, listener.last.failure)
    assertEquals((v1.size / 2).toLong(), listener.last.receivedBytes)
    assertEquals(TRIES, connector.opened.size)
    assertTrue(stagingEmpty())
  }

  @Test
  fun `no connection is the offline state, after every try`() {
    val connector = FakeConnector { FakeResponse(connectError = UnknownHostException("example.test")) }

    val listener = install(v1, connector = connector)

    assertEquals(ToolInstallStage.FAILED, listener.last.stage)
    assertEquals(ToolRejection.OFFLINE, listener.last.failure)
    assertEquals(TRIES, connector.opened.size)
  }

  @Test
  fun `a cancelled install ends cancelled with staging cleaned`() {
    val job = ToolJob().apply { cancel() }

    val listener = install(v1, job = job)

    assertEquals(ToolInstallStage.CANCELLED, listener.last.stage)
    assertNull(installedBytes())
    assertTrue(stagingEmpty())
  }

  @Test
  fun `a tool the index does not list makes no request`() {
    val connector = serving(v1)
    val listener = RecordingListener()

    installer(TestIndex.of(key), connector).install(request(), ToolJob(), listener)

    assertEquals(ToolRejection.NOT_IN_INDEX, listener.last.failure)
    assertTrue(connector.opened.isEmpty())
  }

  @Test
  fun `an unreadable installer state counts as downloads off`() {
    File(installed.toolsDir, ".installer.json").writeText("{not json")
    val connector = serving(v1)

    val listener = install(v1, connector = connector)

    assertEquals(ToolRejection.DOWNLOADS_OFF, listener.last.failure)
    assertTrue(connector.opened.isEmpty())
  }

  @Test
  fun `remove deletes the code only and keeps the high-water mark`() {
    install(v2, "2.0.0")

    installer(null, serving(v1)).remove(TestTool.ID)

    assertFalse(installed.toolDir(TestTool.ID).exists())
    assertEquals(ToolRejection.NOT_INSTALLED, rejectedWith { loadedBytecode() }?.rejection)
    assertEquals("2.0.0", state.highWater(TestTool.ID)?.version)
    assertEquals(ToolDownloads.ON, state.downloads())
    assertTrue(stagingEmpty())
    assertEquals(ToolRejection.ROLLBACK, install(v1).last.failure)
  }

  @Test
  fun `killed mid-download, the old build is intact and staging is cleaned at the next start`() {
    install(v1)
    val stall = StallingStream(v2, v2.size / 2)
    val doomed = Thread {
      installer(TestIndex.of(key, TestIndex.entry(v2, "2.0.0")), FakeConnector { FakeResponse(body = v2, stream = { stall }) })
        .install(request(), ToolJob(), RecordingListener())
    }.apply {
      isDaemon = true
      start()
    }
    assertTrue(stall.stalled.await(WAIT_SECONDS, TimeUnit.SECONDS))

    val restarted = installer(null, FakeConnector { error("no request at start") })
    assertFalse(stagingEmpty())
    restarted.cleanAtStart()

    assertTrue(doomed.isAlive)
    assertTrue(stagingEmpty())
    assertArrayEquals(v1, installedBytes())
    assertArrayEquals(TestTool.BYTECODE, loadedBytecode())
  }

  @Test
  fun `killed just before the move, the old build is intact and staging is cleaned at the next start`() {
    install(v1)
    val atCommit = CountDownLatch(1)
    val never = CountDownLatch(1)
    Thread {
      val stuck: (File, File) -> Boolean = { _, _ ->
        atCommit.countDown()
        never.await()
        false
      }
      installer(TestIndex.of(key, TestIndex.entry(v2, "2.0.0")), serving(v2), commit = stuck)
        .install(request(), ToolJob(), RecordingListener())
    }.apply {
      isDaemon = true
      start()
    }
    assertTrue(atCommit.await(WAIT_SECONDS, TimeUnit.SECONDS))

    installer(null, FakeConnector { error("no request at start") }).cleanAtStart()

    assertTrue(stagingEmpty())
    assertArrayEquals(v1, installedBytes())
    assertArrayEquals(TestTool.BYTECODE, loadedBytecode())
    assertEquals("2.0.0", state.highWater(TestTool.ID)?.version)
  }

  @Test
  fun `turning downloads off during the index check makes no request`() {
    val connector = serving(v1)
    val listener = RecordingListener()
    val signed = TestIndex.of(key, TestIndex.entry(v1))
    val turnsOff = ToolIndexSource {
      state.setDownloads(ToolDownloads.OFF) { emptyMap() }
      signed
    }

    installer(signed, connector, source = turnsOff).install(request(), ToolJob(), listener)

    assertEquals(ToolRejection.DOWNLOADS_OFF, listener.last.failure)
    assertTrue(connector.opened.isEmpty())
  }

  @Test
  fun `turning downloads off during a redirect opens nothing further`() {
    val connector = FakeConnector {
      state.setDownloads(ToolDownloads.OFF) { emptyMap() }
      FakeResponse(HttpURLConnection.HTTP_MOVED_TEMP, location = "/elsewhere")
    }

    val listener = install(v1, connector = connector)

    assertEquals(ToolRejection.DOWNLOADS_OFF, listener.last.failure)
    assertEquals(1, connector.opened.size)
    assertTrue(stagingEmpty())
  }

  @Test
  fun `turning downloads off before a retry opens nothing further`() {
    val connector = FakeConnector {
      state.setDownloads(ToolDownloads.OFF) { emptyMap() }
      FakeResponse(body = v1, stream = { DroppingStream(v1, v1.size / 2) })
    }

    val listener = install(v1, connector = connector)

    assertEquals(ToolRejection.DOWNLOADS_OFF, listener.last.failure)
    assertEquals(1, connector.opened.size)
  }

  @Test
  fun `a malformed version in the state file ends in a failed event, not a throw`() {
    File(installed.toolsDir, ".installer.json").writeText(
      "{\"downloads\":\"ON\",\"highWater\":{\"sample\":{\"version\":\"1.x\",\"manifestSha256\":\"${"a".repeat(SHA_HEX)}\"}}}",
    )
    val connector = serving(v1)

    val listener = install(v1, connector = connector)

    assertEquals(ToolInstallStage.FAILED, listener.last.stage)
    assertEquals(ToolRejection.DOWNLOADS_OFF, listener.last.failure)
    assertTrue(connector.opened.isEmpty())
  }

  @Test
  fun `an unexpected error ends in a failed internal event, not a throw`() {
    val listener = RecordingListener()

    installer(TestIndex.of(key, TestIndex.entry(v1)), serving(v1), space = ToolSpace { error("disk query blew up") })
      .install(request(), ToolJob(), listener)

    assertEquals(ToolInstallStage.FAILED, listener.last.stage)
    assertEquals(ToolRejection.INTERNAL, listener.last.failure)
  }

  @Test
  fun `turning downloads on over an unreadable state keeps installed builds as the rollback floor`() {
    install(v2, "2.0.0")
    File(installed.toolsDir, ".installer.json").writeText("{not json")

    installer(null, serving(v1)).setDownloads(ToolDownloads.ON)

    assertEquals("2.0.0", state.highWater(TestTool.ID)?.version)
    assertEquals(TestIndex.manifestSha(v2), state.highWater(TestTool.ID)?.manifestSha256)
    assertEquals(ToolRejection.ROLLBACK, install(v1).last.failure)
  }

  @Test
  fun `a build for another host API major is incompatible`() {
    val listener = install(build(TestTool.VERSION, hostApiMajor = RULES.hostApiMajor + 1))

    assertEquals(ToolRejection.INCOMPATIBLE, listener.last.failure)
    assertNull(installedBytes())
  }

  @Test
  fun `the catalogue lists the index, what is installed, its check result and the high-water mark`() {
    install(v2, "2.0.0")
    val index = TestIndex.of(key, TestIndex.entry(v1))
    val serving = installer(index, serving(v1))

    val check = InstalledToolCheck(installed, RULES) { ring }
    val catalogue = ToolCatalogueReader(check, serving, state).read()

    assertNull(catalogue.indexProblem)
    assertEquals(listOf(TestTool.ID), catalogue.ids)
    assertEquals("2.0.0", catalogue.installed.single().version)
    assertEquals("2.0.0", catalogue.highWater[TestTool.ID]?.version)
    installed.kbtFile(TestTool.ID).writeBytes(v1.copyOf(v1.size - 1))
    assertNull(catalogue.highWaterProblem)
    assertEquals(ToolRejection.ZIP, ToolCatalogueReader(check, serving, state).read().installed.single().problem)
    assertEquals(ToolRejection.INDEX, ToolCatalogueReader(check, installer(null, serving(v1)), state).read().indexProblem)
    File(installed.toolsDir, ".installer.json").writeText("{not json")
    assertEquals(ToolRejection.IO, ToolCatalogueReader(check, serving, state).read().highWaterProblem)
  }

  @Test
  fun `start cleans a tool folder left without its bundle`() {
    installed.toolDir(TestTool.ID).mkdirs()

    installer(null, serving(v1)).cleanAtStart()

    assertFalse(installed.toolDir(TestTool.ID).exists())
  }

  private companion object {
    const val TRIES = 3
    const val FREE_BYTES = 10L
    const val WAIT_SECONDS = 10L
    const val SHA_HEX = 64
  }
}
