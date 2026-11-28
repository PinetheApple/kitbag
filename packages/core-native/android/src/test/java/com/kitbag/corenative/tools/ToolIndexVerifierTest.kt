package com.kitbag.corenative.tools

import org.junit.Assert.assertEquals
import org.junit.Test

class ToolIndexVerifierTest {
  private val current = TestToolKey.generate("index-current")
  private val next = TestToolKey.generate("index-next")
  private val retired = TestToolKey.generate("index-retired")
  private val kbt = TestTool.signed(current)
  private val ring = TestPins.ring(
    TestPins.tool(current, TestPins.CURRENT),
    TestPins.tool(next, TestPins.NEXT),
    TestPins.tool(retired, TestPins.RETIRED),
  )

  private fun verify(signed: SignedToolIndex, keys: ToolKeyRing = ring) =
    ToolIndexVerifier(RULES, keys, TestIndex.HOST_VERSION_CODE).verify(signed)

  private fun rejection(signed: SignedToolIndex, keys: ToolKeyRing = ring) = rejectedWith { verify(signed, keys) }?.rejection

  @Test
  fun `an index signed by the current or next key lists its tools`() {
    for (key in listOf(current, next)) {
      val index = verify(TestIndex.of(key, TestIndex.entry(kbt)))

      assertEquals(TestIndex.HOST_VERSION_NAME, index.hostVersionName)
      val entry = index.entry(TestTool.ID)!!
      assertEquals(TestTool.sha256(kbt), entry.kbtSha256)
      assertEquals(kbt.size.toLong(), entry.size)
      assertEquals(TestIndex.asset(), entry.asset)
    }
  }

  @Test
  fun `an index for another release is refused`() {
    val other = TestIndex.signed(current, TestIndex.json(current, TestIndex.entry(kbt), versionCode = TestIndex.HOST_VERSION_CODE + 1))

    assertEquals(ToolRejection.OTHER_RELEASE, rejection(other))
  }

  @Test
  fun `a changed byte fails the signature`() {
    val signed = TestIndex.of(current, TestIndex.entry(kbt))
    val text = String(signed.bytes).replace(TestIndex.HOST_VERSION_NAME, "0.101.1")

    assertEquals(ToolRejection.SIGNATURE, rejection(SignedToolIndex(text.toByteArray(), signed.signature)))
  }

  @Test
  fun `a retired, revoked or unpinned key cannot sign an index`() {
    val stranger = TestToolKey.generate("index-stranger")
    val revoked = TestPins.ring(TestPins.tool(current, TestPins.CURRENT), revoked = setOf(current.keyId))

    assertEquals(ToolRejection.UNTRUSTED_KEY, rejection(TestIndex.of(retired, TestIndex.entry(kbt))))
    assertEquals(ToolRejection.UNTRUSTED_KEY, rejection(TestIndex.of(current, TestIndex.entry(kbt)), revoked))
    assertEquals(ToolRejection.UNTRUSTED_KEY, rejection(TestIndex.of(stranger, TestIndex.entry(kbt))))
  }

  @Test
  fun `a malformed signed index is refused`() {
    val cases = listOf(
      TestIndex.json(current, TestIndex.entry(kbt), TestIndex.entry(kbt)),
      TestIndex.json(current, TestIndex.entry(kbt).put("asset", "../tool-sample-1.2.3.kbt")),
      TestIndex.json(current, TestIndex.entry(kbt).put("asset", "tool-sample-1.2.3.zip")),
      TestIndex.json(current, TestIndex.entry(kbt).put("size", RULES.inflatedMaxBytes + 1)),
      TestIndex.json(current, TestIndex.entry(kbt).put("kbtSha256", "nope")),
      TestIndex.json(current, TestIndex.entry(kbt)).put("schema", RULES.schemaVersion + 1),
    )
    for (json in cases) assertEquals(json.toString(), ToolRejection.INDEX, rejection(TestIndex.signed(current, json)))
  }
}
