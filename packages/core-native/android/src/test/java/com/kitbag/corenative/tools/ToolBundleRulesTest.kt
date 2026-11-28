package com.kitbag.corenative.tools

import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ToolBundleRulesTest {
  @Test
  fun `the rules Kotlin reads are the app-shell rules file`() {
    val file = JSONObject(File(RULES_FILE).readText())

    assertTrue(file.similar(JSONObject(TOOL_BUNDLE_RULES_JSON)))
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
