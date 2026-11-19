package com.kitbag.corenative.library

import com.kitbag.corenative.library.move.MoveJournal
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Test
import org.w3c.dom.Element

class BackupRulesTest {
  private val excluded = setOf(DataFolder.STATE_FILE_NAME, MoveJournal.FILE_NAME, AwayManifest.FILE_NAME)

  private fun sections(xml: String, names: List<String>): Map<String, Element> {
    val root = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File(XML_DIR, xml)).documentElement
    return names.associateWith { name ->
      if (root.tagName == name) root else root.getElementsByTagName(name).item(0) as Element
    }
  }

  private fun rules(section: Element, tag: String): Set<Pair<String, String>> {
    val nodes = section.getElementsByTagName(tag)
    return (0 until nodes.length).map { nodes.item(it) as Element }.mapTo(HashSet()) {
      it.getAttribute(DOMAIN) to it.getAttribute(PATH)
    }
  }

  private fun assertExcludesOnly(section: String, element: Element) {
    assertEquals(section, excluded.map { FILE_DOMAIN to it }.toSet(), rules(element, EXCLUDE))
    assertEquals(section, emptySet<Pair<String, String>>(), rules(element, INCLUDE))
  }

  @Test
  fun `full backup excludes the data folder state and nothing else`() {
    sections(FULL_BACKUP_XML, listOf(FULL_BACKUP)).forEach(::assertExcludesOnly)
  }

  @Test
  fun `cloud backup and device transfer both exclude the data folder state`() {
    sections(DATA_EXTRACTION_XML, listOf(CLOUD_BACKUP, DEVICE_TRANSFER)).forEach(::assertExcludesOnly)
  }

  private companion object {
    val XML_DIR = File("src/main/res/xml")
    const val FULL_BACKUP_XML = "kitbag_backup_rules.xml"
    const val DATA_EXTRACTION_XML = "kitbag_data_extraction_rules.xml"
    const val FULL_BACKUP = "full-backup-content"
    const val CLOUD_BACKUP = "cloud-backup"
    const val DEVICE_TRANSFER = "device-transfer"
    const val EXCLUDE = "exclude"
    const val INCLUDE = "include"
    const val DOMAIN = "domain"
    const val PATH = "path"
    const val FILE_DOMAIN = "file"
  }
}
