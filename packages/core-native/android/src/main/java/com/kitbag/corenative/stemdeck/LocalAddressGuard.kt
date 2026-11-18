package com.kitbag.corenative.stemdeck

import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress

object LocalAddressGuard {
  private const val LOCAL_SUFFIX = ".local"
  private const val BITS_PER_BYTE = 8
  private const val BYTE_MASK = 0xff
  private const val IPV4_BYTES = 4
  private val IPV4_LITERAL = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")
  private const val IPV4_MAPPED_ZERO_BYTES = 10
  private val IPV4_MAPPED_PREFIX =
    ByteArray(IPV4_MAPPED_ZERO_BYTES) + byteArrayOf(BYTE_MASK.toByte(), BYTE_MASK.toByte())

  private class Block(network: String, private val prefixBits: Int) {
    private val bytes = InetAddress.getByName(network).address

    fun contains(address: ByteArray): Boolean {
      if (address.size != bytes.size) return false
      val whole = prefixBits / BITS_PER_BYTE
      for (i in 0 until whole) if (address[i] != bytes[i]) return false
      val rest = prefixBits % BITS_PER_BYTE
      if (rest == 0) return true
      val mask = (BYTE_MASK shl (BITS_PER_BYTE - rest)) and BYTE_MASK
      return (address[whole].toInt() and mask) == (bytes[whole].toInt() and mask)
    }
  }

  private val ALLOWED = listOf(
    Block("10.0.0.0", 8),
    Block("172.16.0.0", 12),
    Block("192.168.0.0", 16),
    Block("169.254.0.0", 16),
    Block("fc00::", 7),
    Block("fe80::", 10),
  )

  fun allowsHost(host: String): Boolean =
    IPV4_LITERAL.matches(host) || host.contains(':') || host.lowercase().endsWith(LOCAL_SUFFIX)

  fun allows(address: InetAddress): Boolean {
    val bytes = when (address) {
      is Inet4Address -> address.address
      is Inet6Address -> unmapped(address.address)
      else -> return false
    }
    return ALLOWED.any { it.contains(bytes) }
  }

  private fun unmapped(bytes: ByteArray): ByteArray =
    if (bytes.copyOf(IPV4_MAPPED_PREFIX.size).contentEquals(IPV4_MAPPED_PREFIX)) {
      bytes.copyOfRange(bytes.size - IPV4_BYTES, bytes.size)
    } else {
      bytes
    }
}
