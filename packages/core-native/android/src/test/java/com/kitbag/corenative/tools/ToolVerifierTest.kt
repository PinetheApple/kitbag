package com.kitbag.corenative.tools

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ToolVerifierTest {
  private val current = TestToolKey.generate("current")
  private val other = TestToolKey.generate("other")
  private val ring = TestPins.ring(TestPins.tool(current, TestPins.CURRENT))

  private fun verify(kbt: ByteArray, keys: ToolKeyRing = ring, use: ToolKeyUse = ToolKeyUse.INSTALL) =
    ToolVerifier(RULES, keys).verify(kbt, TestTool.ID, use)

  private fun withFiles(files: List<ZipItem>, listed: List<ZipItem> = files) =
    TestTool.signed(current, TestTool.manifest(current.keyId, listed), files)

  @Test
  fun `a build signed by a pinned current key yields its exact bytecode and manifest version`() {
    val tool = verify(TestTool.signed(current))

    assertEquals(TestTool.ID, tool.id)
    assertArrayEquals(TestTool.BYTECODE, tool.bytecode)
    assertEquals(TestTool.BYTECODE_VERSION, tool.bytecodeVersion)
  }

  @Test
  fun `a signature by another key under a pinned key id is rejected`() {
    val bytes = TestTool.manifest(current.keyId).toString().toByteArray()

    assertEquals(ToolRejection.SIGNATURE, rejectedWith { verify(TestTool.kbt(bytes, other.sign(bytes))) }?.rejection)
  }

  @Test
  fun `a manifest changed after signing is rejected`() {
    val signedBytes = TestTool.manifest(current.keyId).toString().toByteArray()
    val tampered = TestTool.manifest(current.keyId).put("name", "Tampered").toString().toByteArray()

    assertEquals(ToolRejection.SIGNATURE, rejectedWith { verify(TestTool.kbt(tampered, current.sign(signedBytes))) }?.rejection)
  }

  @Test
  fun `a key the pins do not hold is rejected`() {
    assertEquals(ToolRejection.UNTRUSTED_KEY, rejectedWith { verify(TestTool.signed(other)) }?.rejection)
  }

  @Test
  fun `a revoked key is rejected for install and for load`() {
    val revoked = TestPins.ring(TestPins.tool(current, TestPins.RETIRED), revoked = setOf(current.keyId))
    val kbt = TestTool.signed(current)

    assertEquals(ToolRejection.UNTRUSTED_KEY, rejectedWith { verify(kbt, revoked, ToolKeyUse.INSTALL) }?.rejection)
    assertEquals(ToolRejection.UNTRUSTED_KEY, rejectedWith { verify(kbt, revoked, ToolKeyUse.LOAD) }?.rejection)
  }

  @Test
  fun `a retired key installs nothing but the builds it signed still load`() {
    val retired = TestPins.ring(TestPins.tool(current, TestPins.RETIRED))
    val kbt = TestTool.signed(current)

    assertEquals(ToolRejection.UNTRUSTED_KEY, rejectedWith { verify(kbt, retired, ToolKeyUse.INSTALL) }?.rejection)
    assertEquals(TestTool.ID, verify(kbt, retired, ToolKeyUse.LOAD).id)
  }

  @Test
  fun `after rotation the old build loads and builds by the new current and next keys install`() {
    val next = TestToolKey.generate("next")
    val third = TestToolKey.generate("third")
    val oldBuild = TestTool.signed(current)
    assertEquals(TestTool.ID, verify(oldBuild).id)

    val rotated = TestPins.ring(
      TestPins.tool(current, TestPins.RETIRED),
      TestPins.tool(next, TestPins.CURRENT),
      TestPins.tool(third, TestPins.NEXT),
    )

    assertEquals(TestTool.ID, verify(oldBuild, rotated, ToolKeyUse.LOAD).id)
    assertEquals(ToolRejection.UNTRUSTED_KEY, rejectedWith { verify(oldBuild, rotated, ToolKeyUse.INSTALL) }?.rejection)
    assertEquals(TestTool.ID, verify(TestTool.signed(next), rotated, ToolKeyUse.INSTALL).id)
    assertEquals(TestTool.ID, verify(TestTool.signed(third), rotated, ToolKeyUse.INSTALL).id)
  }

  @Test
  fun `a revocation key cannot sign a tool, whatever status it carries`() {
    val publicKey = ToolKeyRing.p256Key(current.spkiBase64, RULES)!!
    val keys = ToolKeyRing(
      listOf(PinnedToolKey(current.keyId, TestPins.REVOCATION_ROLE, TestPins.CURRENT, publicKey)),
      emptySet(),
      RULES,
    )

    assertEquals(ToolRejection.UNTRUSTED_KEY, rejectedWith { verify(TestTool.signed(current), keys, ToolKeyUse.LOAD) }?.rejection)
  }

  @Test
  fun `a file whose sha256 differs from the manifest is rejected`() {
    val listed = listOf(ZipItem(RULES.entryFile, TestTool.BYTECODE), ZipItem(TestTool.ASSET, "other".toByteArray()))
    val shipped = listOf(listed[0], ZipItem(TestTool.ASSET, "OTHER".toByteArray()))

    assertEquals(ToolRejection.FILES, rejectedWith { verify(withFiles(shipped, listed)) }?.rejection)
  }

  @Test
  fun `a file whose size differs from the manifest is rejected even when its sha256 matches`() {
    val manifest = TestTool.manifest(current.keyId)
    val asset = manifest.getJSONArray("files").getJSONObject(1)
    asset.put("size", asset.getInt("size") + 1)
    manifest.put("size", manifest.getInt("size") + 1)

    assertEquals(ToolRejection.FILES, rejectedWith { verify(TestTool.signed(current, manifest)) }?.rejection)
  }

  @Test
  fun `an entry the manifest does not list is rejected`() {
    val extra = TestTool.files() + ZipItem("assets/extra.json", "{}".toByteArray())

    assertEquals(ToolRejection.FILES, rejectedWith { verify(withFiles(extra, TestTool.files())) }?.rejection)
  }

  @Test
  fun `a listed file missing from the archive is rejected`() {
    assertEquals(ToolRejection.FILES, rejectedWith { verify(withFiles(TestTool.files().take(1), TestTool.files())) }?.rejection)
  }

  @Test
  fun `a duplicate entry is rejected`() {
    val doubled = TestTool.files() + ZipItem(RULES.entryFile, TestTool.BYTECODE)
    val manifestBytes = TestTool.manifest(current.keyId).toString().toByteArray()
    val doubledManifest = TestZip.write(
      listOf(
        ZipItem(RULES.manifestFile, manifestBytes),
        ZipItem(RULES.manifestFile, manifestBytes),
        ZipItem(RULES.manifestSigFile, current.sign(manifestBytes)),
      ) + TestTool.files(),
    )

    assertEquals(ToolRejection.FILES, rejectedWith { verify(withFiles(doubled, TestTool.files())) }?.rejection)
    assertEquals(ToolRejection.FILES, rejectedWith { verify(doubledManifest) }?.rejection)
  }

  @Test
  fun `a path that escapes the bundle is rejected whether or not the manifest lists it`() {
    val escaping = ZipItem("assets/../../evil.js", "x".toByteArray())
    val listedEscape = TestTool.files() + escaping
    val unlisted = listOf("../evil.js", "/evil.js", "assets/../../evil.js")

    assertEquals(ToolRejection.MANIFEST, rejectedWith { verify(withFiles(listedEscape)) }?.rejection)
    for (name in unlisted) {
      val files = TestTool.files() + ZipItem(name, "x".toByteArray())
      assertEquals(name, ToolRejection.FILES, rejectedWith { verify(withFiles(files, TestTool.files())) }?.rejection)
    }
  }

  @Test
  fun `a bundle signed for another tool id is rejected`() {
    val kbt = TestTool.signed(current, TestTool.manifest(current.keyId, id = "other"))

    assertEquals(ToolRejection.WRONG_TOOL, rejectedWith { verify(kbt) }?.rejection)
  }

  @Test
  fun `a manifest bytecode version that is not a whole number the runtime can hold is rejected`() {
    val badVersions = listOf<Any>(-1, 1.5, "96", Int.MAX_VALUE.toLong() + 1)

    for (version in badVersions) {
      val manifest = TestTool.manifest(current.keyId)
      manifest.getJSONObject("runtime").put(RULES.bytecodeVersionField, version)
      assertEquals(version.toString(), ToolRejection.MANIFEST, rejectedWith { verify(TestTool.signed(current, manifest)) }?.rejection)
    }
  }

  @Test
  fun `the manifest rules from the rules file reject a malformed signed manifest`() {
    val tooLong = "n".repeat(RULES.nameMax + 1)
    val breaks = listOf<(JSONObject) -> Unit>(
      { it.put("unknown", true) },
      { it.put("name", tooLong) },
      {
        it.put("routes", JSONArray(listOf(RULES.routePrefix + "other")))
        it.remove("homeTile")
      },
      { it.put("size", 1) },
      { it.put("entry", TestTool.ASSET) },
      { it.put("schema", RULES.schemaVersion + 1) },
      { it.getJSONObject("runtime").remove(RULES.runtimePackageFields.last()) },
    )

    for ((index, breakIt) in breaks.withIndex()) {
      val manifest = TestTool.manifest(current.keyId).also(breakIt)
      assertEquals("break $index", ToolRejection.MANIFEST, rejectedWith { verify(TestTool.signed(current, manifest)) }?.rejection)
    }
  }

  @Test
  fun `a manifest signed under another algorithm name is rejected`() {
    val manifest = TestTool.manifest(current.keyId)
    manifest.getJSONObject("signature").put("alg", "RS256")

    assertEquals(ToolRejection.MANIFEST, rejectedWith { verify(TestTool.signed(current, manifest)) }?.rejection)
  }

  private fun signedText(text: String): ByteArray {
    val bytes = text.toByteArray()
    return TestTool.kbt(bytes, current.sign(bytes))
  }

  @Test
  fun `a manifest that repeats a key is rejected by the verifier itself`() {
    val repeated = TestTool.manifest(current.keyId).toString().replaceFirst("{", "{\"name\":\"Shadow\",")

    val message = rejectedWith { verify(signedText(repeated)) }?.message

    assertTrue("$message", message?.contains("repeats the key name") == true)
  }

  @Test
  fun `a manifest with text after its object is rejected, trailing whitespace is not`() {
    val text = TestTool.manifest(current.keyId).toString()

    val message = rejectedWith { verify(signedText("$text {}")) }?.message

    assertTrue("$message", message?.contains("text after its object") == true)
    assertEquals(TestTool.ID, verify(signedText("$text\n")).id)
  }
}
