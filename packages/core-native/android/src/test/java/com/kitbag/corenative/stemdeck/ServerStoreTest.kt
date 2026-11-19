package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ServerStoreTest {
  private lateinit var root: File
  private lateinit var file: File
  private var now = 1000L
  private val secure = ServerOrigin.parse("https://192.168.1.50:8443")!!
  private val plain = ServerOrigin.parse("http://10.0.0.12:8000")!!
  private val pin = "4f2a91c07be355d8" + "0".repeat(48)
  private val other = "c81e0d47a9f32b66" + "0".repeat(48)

  private fun store() = ServerStore(file, { now })

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stemdeck-servers").toFile()
    file = File(File(root, ServerStore.DIR_NAME), ServerStore.FILE_NAME)
  }

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun `only the fingerprint the last probe saw can be trusted`() {
    val store = store()
    assertFalse(store.trust(secure, pin))
    store.probed(secure, pin, systemVerified = false)
    assertFalse(store.trust(secure, other))
    assertFalse(store.trust(secure, null))
    assertTrue(store.trust(secure, pin.uppercase()))
    assertFalse(store.trust(secure, pin))
    assertEquals(KnownServer(secure.canonical, pin, 1000, 1000, false), store().find(secure.canonical))
    assertTrue((store.policy(secure) as TrustPolicy.Pinned).fingerprint == pin)
  }

  @Test
  fun `a chain Android trusts is remembered without a pin`() {
    val store = store()
    store.probed(secure, pin, systemVerified = true)
    assertTrue(store.trust(secure, null))
    assertNull(store.find(secure.canonical)?.fingerprint)
    assertEquals(TrustPolicy.System, store.policy(secure))
  }

  @Test
  fun `plain http is remembered as plain and never with a pin`() {
    val store = store()
    store.probed(plain, null, systemVerified = false)
    assertFalse(store.trust(plain, pin))
    assertTrue(store.trust(plain, null))
    assertTrue(store.find(plain.canonical)!!.plain)
  }

  @Test
  fun `a re-trusted certificate replaces the old pin, touch and forget change only that server`() {
    val store = store()
    store.probed(secure, pin, false)
    store.trust(secure, pin)
    store.probed(plain, null, false)
    store.trust(plain, null)
    store.probed(secure, other, false)
    now = 2000
    assertTrue(store.trust(secure, other))
    assertEquals(other, store.find(secure.canonical)?.fingerprint)
    now = 3000
    store.touch(plain)
    assertEquals(3000L, store.find(plain.canonical)?.lastUsedAt)
    store.forget(secure)
    assertEquals(listOf(plain.canonical), store().all().map { it.origin })
  }

  @Test
  fun `an unreadable file reads as no servers`() {
    file.parentFile.mkdirs()
    file.writeText("{not json")
    assertEquals(emptyList<KnownServer>(), store().all())
  }
}
