package com.kitbag.corenative.stemdeck

import java.net.Inet6Address
import java.net.InetAddress
import org.junit.Assert.assertEquals
import org.junit.Test

class LocalAddressGuardTest {
  private fun mapped(v4: String): InetAddress {
    val bytes = ByteArray(16)
    bytes[10] = 0xff.toByte()
    bytes[11] = 0xff.toByte()
    InetAddress.getByName(v4).address.copyInto(bytes, 12)
    return Inet6Address.getByAddress(null, bytes, -1)
  }

  @Test
  fun `private and link-local addresses are allowed, everything else is refused`() {
    val cases = mapOf(
      "10.0.0.1" to true,
      "10.255.255.255" to true,
      "172.16.0.1" to true,
      "172.31.255.254" to true,
      "172.15.255.255" to false,
      "172.32.0.1" to false,
      "192.168.1.50" to true,
      "192.169.0.1" to false,
      "169.254.10.20" to true,
      "169.255.0.1" to false,
      "11.0.0.1" to false,
      "8.8.8.8" to false,
      "127.0.0.1" to false,
      "0.0.0.0" to false,
      "fc00::1" to true,
      "fdff:ffff::1" to true,
      "fbff::1" to false,
      "fe80::1" to true,
      "febf::1" to true,
      "fec0::1" to false,
      "::1" to false,
      "2001:4860:4860::8888" to false,
    )
    val actual = cases.keys.associateWith { LocalAddressGuard.allows(InetAddress.getByName(it)) }
    assertEquals(cases, actual)
  }

  @Test
  fun `an IPv4-mapped IPv6 address is judged by its IPv4 address`() {
    assertEquals(true, LocalAddressGuard.allows(mapped("192.168.1.5")))
    assertEquals(false, LocalAddressGuard.allows(mapped("8.8.8.8")))
    assertEquals(false, LocalAddressGuard.allows(mapped("127.0.0.1")))
  }

  @Test
  fun `plain http names only literal addresses and local hosts`() {
    val cases = mapOf(
      "192.168.1.50" to true,
      "fe80::1" to true,
      "studio.local" to true,
      "Studio.LOCAL" to true,
      "localhost" to false,
      "example.com" to false,
      "studio.local.example.com" to false,
      "192.168.1" to false,
    )
    assertEquals(cases, cases.keys.associateWith(LocalAddressGuard::allowsHost))
  }
}
