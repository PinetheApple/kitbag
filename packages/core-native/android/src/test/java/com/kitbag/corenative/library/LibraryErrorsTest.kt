package com.kitbag.corenative.library

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Test

class LibraryErrorsTest {
  @Test
  fun `an unmounted data folder anywhere in the cause chain rejects as unavailable`() {
    val unavailable = DataFolderUnavailableException(CARD_UUID)
    for (error in listOf(unavailable, IOException(unavailable), RuntimeException(IOException(unavailable)))) {
      assertEquals("$error", LibraryErrors.DATA_FOLDER_UNAVAILABLE, LibraryErrors.codeFor(error, FALLBACK))
    }
  }

  @Test
  fun `any other error keeps the call's own code`() {
    assertEquals(FALLBACK, LibraryErrors.codeFor(IOException("disk full"), FALLBACK))
  }

  @Test
  fun `a database copy rejects with the code of why it could not be made`() {
    assertEquals(LibraryErrors.DATABASE_COPY_NO_SPACE, LibraryErrors.databaseCopyCode(DatabaseCopyNoSpaceException()))
    assertEquals(LibraryErrors.DATABASE_COPY_UNREADABLE, LibraryErrors.databaseCopyCode(DatabaseCopyUnreadableException()))
    assertEquals(LibraryErrors.SAVE_FAILED, LibraryErrors.databaseCopyCode(IOException("disk full")))
  }

  private companion object {
    const val CARD_UUID = "1234-ABCD"
    const val FALLBACK = "E_IMPORT_FAILED"
  }
}
