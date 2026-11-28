package com.kitbag.corenative.tools

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ToolBundleRulesTest {
  private fun canonical(value: Any?): Any? =
    when (value) {
      is JSONObject -> value.keys().asSequence().associateWith { canonical(value.get(it)) }.toSortedMap()
      is JSONArray -> (0 until value.length()).map { canonical(value.get(it)) }
      else -> value
    }

  private fun canonicalRules(text: String) = canonical(JSONObject(text))

  @Test
  fun `the rules Kotlin reads are the app-shell rules file`() {
    assertEquals(canonicalRules(File(RULES_FILE).readText()), canonicalRules(TOOL_BUNDLE_RULES_JSON))
  }

  @Test
  fun `the comparison sees a changed nested value`() {
    val changed = JSONObject(TOOL_BUNDLE_RULES_JSON)
    changed.getJSONObject("keys").getJSONArray("statuses").put(RULES.testKeyPrefix)

    assertNotEquals(canonicalRules(TOOL_BUNDLE_RULES_JSON), canonical(changed))
  }

  @Test
  fun `the patterns hold as whole-string matches`() {
    assertTrue(RULES.id.matches(TestTool.ID))
    assertFalse(RULES.id.matches(TestTool.ID + "\n"))
    assertFalse(RULES.filePath.matches("assets/../x"))
    assertTrue(RULES.filePath.matches(TestTool.ASSET))
  }

  private companion object {
    const val RULES_FILE = "../../app-shell/tool-bundle-rules.json"
  }
}
