package com.kitbag.corenative.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.json.JSONObject

class ToolKeyRingTest {
  private val key = TestToolKey.generate("ring")

  private fun parsed(vararg pins: Pin) = rejection { TestPins.ring(*pins) }

  @Test
  fun `a well-formed pin file yields the tool key for each use its status allows`() {
    val ring = TestPins.ring(TestPins.tool(key, TestPins.NEXT))

    assertNotNull(ring.signer(key.keyId, ToolKeyUse.INSTALL))
    assertNotNull(ring.signer(key.keyId, ToolKeyUse.LOAD))
  }

  @Test
  fun `a malformed pin is refused rather than skipped`() {
    val p384 = TestToolKey.generate("p384", "secp384r1")
    val bad = listOf(
      Pin(key.keyId, key.spkiBase64, status = "pending"),
      Pin(key.keyId, key.spkiBase64, role = "builds", status = TestPins.CURRENT),
      Pin(key.keyId, key.spkiBase64, TestPins.REVOCATION_ROLE, status = TestPins.CURRENT),
      Pin(key.keyId, key.spkiBase64, status = null),
      Pin(key.keyId, "not base64!", status = TestPins.CURRENT),
      Pin(p384.keyId, p384.spkiBase64, status = TestPins.CURRENT),
      Pin("Not-A-Key-Id", key.spkiBase64, status = TestPins.CURRENT),
    )

    for (pin in bad) assertEquals(pin.keyId + " " + pin.status, ToolRejection.PINS, parsed(pin))
    assertEquals(ToolRejection.PINS, parsed(TestPins.tool(key, TestPins.CURRENT), TestPins.tool(key, TestPins.NEXT)))
  }

  @Test
  fun `a key on another curve is refused even at a P-256 key's size`() {
    val p384 = TestToolKey.generate("p384", "secp384r1")
    val p384Bytes = java.util.Base64.getDecoder().decode(p384.spkiBase64).size
    val sized = JSONObject(TOOL_BUNDLE_RULES_JSON).apply { getJSONObject("keys").put("spkiBytes", p384Bytes) }

    assertNull(ToolKeyRing.p256Key(p384.spkiBase64, ToolBundleRules(sized)))
  }

  @Test
  fun `a pin file of another schema is refused`() {
    val json = TestPins.json(TestPins.tool(key, TestPins.CURRENT)).replace("\"schema\":1", "\"schema\":2")

    assertEquals(ToolRejection.PINS, rejection { ToolKeyRing.parse(json, emptySet(), RULES) })
  }

  @Test
  fun `an unknown key id has no signer`() {
    assertNull(TestPins.ring(TestPins.tool(key, TestPins.CURRENT)).signer("test-unknown", ToolKeyUse.LOAD))
  }
}
