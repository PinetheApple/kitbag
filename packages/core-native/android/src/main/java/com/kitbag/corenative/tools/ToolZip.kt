package com.kitbag.corenative.tools

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.util.zip.CRC32
import java.util.zip.DataFormatException
import java.util.zip.Inflater

internal class ToolZipEntry(val name: String, val data: ByteArray)

internal object ToolZip {
  private const val UTF8_NAMES = 0x0800
  private const val ENCRYPTED = 0x0001
  private const val DEFLATED = 8
  private const val U16_MASK = 0xffff
  private const val U32_MASK = 0xffffffffL
  private const val RAW_DEFLATE = true
  private const val INFLATES_SHORT = "inflates short of its declared size"
  private const val INFLATES_PAST = "inflates past its declared size or is corrupt"
  private const val CRC_MISMATCH = "CRC does not match"

  private object Local {
    const val SIGNATURE = 0x04034b50L
    const val FLAGS = 6
    const val METHOD = 8
    const val CRC = 14
    const val PACKED_SIZE = 18
    const val SIZE = 22
    const val NAME_LENGTH = 26
    const val EXTRA_LENGTH = 28
    const val BYTES = 30
  }

  private object Central {
    const val SIGNATURE = 0x02014b50L
    const val FLAGS = 8
    const val METHOD = 10
    const val CRC = 16
    const val PACKED_SIZE = 20
    const val SIZE = 24
    const val NAME_LENGTH = 28
    const val EXTRA_LENGTH = 30
    const val COMMENT_LENGTH = 32
    const val LOCAL_OFFSET = 42
    const val BYTES = 46
  }

  private object End {
    const val SIGNATURE = 0x06054b50L
    const val DISK = 4
    const val DIRECTORY_DISK = 6
    const val DISK_ENTRIES = 8
    const val ENTRIES = 10
    const val DIRECTORY_SIZE = 12
    const val DIRECTORY_OFFSET = 16
    const val COMMENT_LENGTH = 20
    const val BYTES = 22
  }

  private class Entry(
    val label: String,
    val name: ByteArray,
    val flags: Int,
    val method: Int,
    val crc: Long,
    val packedSize: Long,
    val size: Long,
    val localOffset: Long,
  )

  private class Span(val entry: Entry, val start: Long, val dataAt: Long, val end: Long)

  private class Reader(private val bytes: ByteArray) {
    private val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)

    fun u16(at: Long): Int = buffer.getShort(checkedIndex(at, Short.SIZE_BYTES.toLong())).toInt() and U16_MASK

    fun u32(at: Long): Long = buffer.getInt(checkedIndex(at, Int.SIZE_BYTES.toLong())).toLong() and U32_MASK

    fun slice(at: Long, length: Int): ByteArray {
      val from = checkedIndex(at, length.toLong())
      return bytes.copyOfRange(from, from + length)
    }

    fun checkedIndex(at: Long, length: Long): Int {
      if (at < 0 || at + length > bytes.size) fail("truncated zip")
      return at.toInt()
    }
  }

  fun read(bytes: ByteArray, maxInflatedBytes: Long): List<ToolZipEntry> {
    val reader = Reader(bytes)
    val endAt = bytes.size.toLong() - End.BYTES
    val (entries, directoryOffset) = readDirectory(reader, endAt)
    val spans = entries.map { locate(reader, it) }
    checkLayout(spans, directoryOffset, maxInflatedBytes)
    return spans.map { ToolZipEntry(it.entry.label, inflate(bytes, it)) }
  }

  private fun readDirectory(reader: Reader, endAt: Long): Pair<List<Entry>, Long> {
    if (reader.u32(endAt) != End.SIGNATURE || reader.u16(endAt + End.COMMENT_LENGTH) != 0) {
      fail("no end of central directory at the end of the archive")
    }
    val count = reader.u16(endAt + End.ENTRIES)
    val multiDisk = reader.u16(endAt + End.DISK) != 0 ||
      reader.u16(endAt + End.DIRECTORY_DISK) != 0 ||
      reader.u16(endAt + End.DISK_ENTRIES) != count
    if (multiDisk) fail("multi-disk archives are not supported")
    val directoryOffset = reader.u32(endAt + End.DIRECTORY_OFFSET)
    if (directoryOffset + reader.u32(endAt + End.DIRECTORY_SIZE) != endAt) {
      fail("central directory does not end where the end record starts")
    }
    val entries = ArrayList<Entry>(count)
    var at = directoryOffset
    repeat(count) {
      entries += readEntry(reader, at)
      at += Central.BYTES + reader.u16(at + Central.NAME_LENGTH) +
        reader.u16(at + Central.EXTRA_LENGTH) + reader.u16(at + Central.COMMENT_LENGTH)
    }
    if (at != endAt) fail("central directory size does not match its entries")
    return entries to directoryOffset
  }

  private fun readEntry(reader: Reader, at: Long): Entry {
    if (reader.u32(at) != Central.SIGNATURE) fail("bad central directory entry")
    val name = reader.slice(at + Central.BYTES, reader.u16(at + Central.NAME_LENGTH))
    return Entry(
      label = decodeName(name),
      name = name,
      flags = reader.u16(at + Central.FLAGS),
      method = reader.u16(at + Central.METHOD),
      crc = reader.u32(at + Central.CRC),
      packedSize = reader.u32(at + Central.PACKED_SIZE),
      size = reader.u32(at + Central.SIZE),
      localOffset = reader.u32(at + Central.LOCAL_OFFSET),
    )
  }

  private fun locate(reader: Reader, entry: Entry): Span {
    val label = entry.label
    if (entry.flags and ENCRYPTED != 0) fail("$label: encrypted")
    if (entry.flags != UTF8_NAMES) fail("$label: unsupported flags")
    if (entry.method != DEFLATED) fail("$label: not deflated")
    val at = entry.localOffset
    if (reader.u32(at) != Local.SIGNATURE) fail("$label: bad local header")
    val nameLength = reader.u16(at + Local.NAME_LENGTH)
    val agrees =
      reader.slice(at + Local.BYTES, nameLength).contentEquals(entry.name) &&
        reader.u16(at + Local.FLAGS) == entry.flags &&
        reader.u16(at + Local.METHOD) == entry.method &&
        reader.u32(at + Local.CRC) == entry.crc &&
        reader.u32(at + Local.PACKED_SIZE) == entry.packedSize &&
        reader.u32(at + Local.SIZE) == entry.size
    if (!agrees) fail("$label: local and central headers disagree")
    val dataAt = at + Local.BYTES + nameLength + reader.u16(at + Local.EXTRA_LENGTH)
    return Span(entry, at, dataAt, dataAt + entry.packedSize)
  }

  private fun checkLayout(spans: List<Span>, directoryOffset: Long, maxInflatedBytes: Long) {
    val declared = spans.sumOf { it.entry.size }
    if (declared > maxInflatedBytes) fail("entries declare $declared bytes, over $maxInflatedBytes")
    var previousEnd = 0L
    for (span in spans.sortedBy { it.start }) {
      if (span.start < previousEnd) fail("${span.entry.label}: overlaps another entry")
      previousEnd = span.end
    }
    if (previousEnd > directoryOffset) fail("an entry runs into the central directory")
  }

  private fun inflate(bytes: ByteArray, span: Span): ByteArray {
    val entry = span.entry
    val out = ByteArray(entry.size.toInt())
    val inflater = Inflater(RAW_DEFLATE)
    try {
      inflater.setInput(bytes, span.dataAt.toInt(), entry.packedSize.toInt())
      var filled = 0
      while (!inflater.finished()) {
        val read = inflater.inflate(out, filled, out.size - filled)
        if (read == 0) break
        filled += read
      }
      if (filled != out.size) fail("${entry.label}: $INFLATES_SHORT")
      if (!inflater.finished() || inflater.remaining != 0) fail("${entry.label}: $INFLATES_PAST")
    } catch (error: DataFormatException) {
      fail("${entry.label}: $INFLATES_PAST")
    } finally {
      inflater.end()
    }
    if (CRC32().apply { update(out) }.value != entry.crc) fail("${entry.label}: $CRC_MISMATCH")
    return out
  }

  private fun decodeName(name: ByteArray): String =
    try {
      Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(name))
        .toString()
    } catch (error: CharacterCodingException) {
      fail("an entry name is not UTF-8")
    }

  private fun fail(message: String): Nothing = reject(ToolRejection.ZIP, message)
}
