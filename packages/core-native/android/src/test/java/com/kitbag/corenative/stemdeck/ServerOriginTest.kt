package com.kitbag.corenative.stemdeck

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerOriginTest {
  @Test
  fun `an origin is canonical with an explicit port`() {
    val cases = mapOf(
      "https://192.168.1.50:8443" to "https://192.168.1.50:8443",
      "https://studio.local" to "https://studio.local:443",
      "http://10.0.0.12" to "http://10.0.0.12:80",
      " HTTPS://Studio.Local:8443/ " to "https://studio.local:8443",
      "https://[FE80::1]:8443" to "https://[fe80::1]:8443",
    )
    assertEquals(cases, cases.keys.associateWith { ServerOrigin.parse(it)?.canonical })
  }

  @Test
  fun `anything but a bare http or https origin is refused`() {
    listOf(
      "ftp://192.168.1.50",
      "https://user@192.168.1.50",
      "https://192.168.1.50/api/jobs",
      "https://192.168.1.50?x=1",
      "https://192.168.1.50#top",
      "https://192.168.1.50:0",
      "https://192.168.1.50:70000",
      "192.168.1.50:8443",
      "https://",
      "not an address",
    ).forEach { assertNull(it, ServerOrigin.parse(it)) }
  }

  @Test
  fun `paths are appended to the origin`() {
    val origin = ServerOrigin.parse("https://192.168.1.50:8443")!!
    assertTrue(origin.secure)
    assertEquals("https://192.168.1.50:8443/api/health", origin.url("/api/health").toString())
    assertFalse(ServerOrigin.parse("http://10.0.0.12:8000")!!.secure)
    assertEquals("http://10.0.0.5:8000", ServerOrigin.parse("http://studio.local:8000")!!.withHost("10.0.0.5").canonical)
  }
}
