package com.kitbag.corenative.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BackupShareTest {
  @Test
  fun sharesBackupsAsJsonUnderTheDefaultChooserTitle() {
    assertEquals("application/json", BackupShare.SPEC.mime)
    assertNull(BackupShare.SPEC.chooserTitle)
    assertEquals("backup", BackupShare.SPEC.subject)
  }
}
