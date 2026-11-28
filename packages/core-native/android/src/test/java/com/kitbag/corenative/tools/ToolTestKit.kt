package com.kitbag.corenative.tools

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import java.util.zip.CRC32
import java.util.zip.Deflater

internal val RULES = ToolBundleRules.bundled

internal class ZipItem(
  val name: String,
  val data: ByteArray,
  val declaredSize: Long = data.size.toLong(),
  val crc: Long = CRC32().apply { update(data) }.value,
  val localName: String = name,
)

internal object TestZip {
  private const val VERSION = 20
  private const val UTF8_NAMES = 0x0800
  private const val DEFLATED = 8
  private const val DOS_1980_01_01 = 0x21
  private const val LOCAL_SIGNATURE = 0x04034b50
  private const val CENTRAL_SIGNATURE = 0x02014b50
  private const val END_SIGNATURE = 0x06054b50
  private const val LOCAL_BYTES = 30
  private const val CENTRAL_BYTES = 46
  private const val END_BYTES = 22
  private const val CHUNK_BYTES = 4096

  private class Written(val item: ZipItem, val packed: ByteArray, val offset: Int)

  fun write(items: List<ZipItem>, centralOrder: List<Int> = items.indices.toList()): ByteArray {
    val body = ByteArrayOutputStream()
    val written = items.map { item ->
      val packed = deflate(item.data)
      val name = item.localName.toByteArray()
      Written(item, packed, body.size()).also {
        body.write(header(LOCAL_BYTES, LOCAL_SIGNATURE, item, packed, name.size, central = false))
        body.write(name)
        body.write(packed)
      }
    }
    val directoryOffset = body.size()
    for (index in centralOrder) {
      val entry = written[index]
      val name = entry.item.name.toByteArray()
      body.write(header(CENTRAL_BYTES, CENTRAL_SIGNATURE, entry.item, entry.packed, name.size, central = true, entry.offset))
      body.write(name)
    }
    val directorySize = body.size() - directoryOffset
    val end = ByteBuffer.allocate(END_BYTES).order(ByteOrder.LITTLE_ENDIAN)
      .putInt(END_SIGNATURE).putShort(0).putShort(0)
      .putShort(centralOrder.size.toShort()).putShort(centralOrder.size.toShort())
      .putInt(directorySize).putInt(directoryOffset).putShort(0)
    body.write(end.array())
    return body.toByteArray()
  }

  private fun header(
    bytes: Int,
    signature: Int,
    item: ZipItem,
    packed: ByteArray,
    nameLength: Int,
    central: Boolean,
    offset: Int = 0,
  ): ByteArray {
    val buffer = ByteBuffer.allocate(bytes).order(ByteOrder.LITTLE_ENDIAN).putInt(signature)
    if (central) buffer.putShort(VERSION.toShort())
    buffer.putShort(VERSION.toShort()).putShort(UTF8_NAMES.toShort()).putShort(DEFLATED.toShort())
      .putShort(0).putShort(DOS_1980_01_01.toShort())
      .putInt(item.crc.toInt()).putInt(packed.size).putInt(item.declaredSize.toInt())
      .putShort(nameLength.toShort()).putShort(0)
    if (central) buffer.putShort(0).putShort(0).putShort(0).putInt(0).putInt(offset)
    return buffer.array()
  }

  private fun deflate(data: ByteArray): ByteArray {
    val deflater = Deflater(Deflater.DEFAULT_COMPRESSION, true).apply {
      setInput(data)
      finish()
    }
    val out = ByteArrayOutputStream()
    val chunk = ByteArray(CHUNK_BYTES)
    while (!deflater.finished()) out.write(chunk, 0, deflater.deflate(chunk))
    deflater.end()
    return out.toByteArray()
  }
}

internal class TestToolKey private constructor(val keyId: String, private val pair: KeyPair) {
  val spkiBase64: String = Base64.getEncoder().encodeToString(pair.public.encoded)

  fun sign(data: ByteArray): ByteArray =
    Signature.getInstance(JCA_SIGNATURE).run {
      initSign(pair.private)
      update(data)
      sign()
    }

  companion object {
    private const val JCA_SIGNATURE = "SHA256withECDSA"
    private const val KEY_ALGORITHM = "EC"
    const val P256 = "secp256r1"

    fun generate(name: String, curve: String = P256): TestToolKey {
      val generator = KeyPairGenerator.getInstance(KEY_ALGORITHM).apply { initialize(ECGenParameterSpec(curve)) }
      return TestToolKey(RULES.testKeyPrefix + name, generator.generateKeyPair())
    }
  }
}

internal class Pin(val keyId: String, val spkiBase64: String, val role: String = RULES.toolRole, val status: String?)

internal object TestPins {
  const val CURRENT = "current"
  const val NEXT = "next"
  const val RETIRED = "retired"
  const val REVOCATION_ROLE = "revocation"

  fun json(vararg pins: Pin): String =
    JSONObject()
      .put("schema", RULES.schemaVersion)
      .put(
        "keys",
        JSONArray(
          pins.map {
            JSONObject().put("keyId", it.keyId).put("role", it.role).put("spkiBase64", it.spkiBase64)
              .apply { if (it.status != null) put("status", it.status) }
          },
        ),
      )
      .toString()

  fun ring(vararg pins: Pin, revoked: Set<String> = emptySet()): ToolKeyRing = ToolKeyRing.parse(json(*pins), revoked, RULES)

  fun tool(key: TestToolKey, status: String) = Pin(key.keyId, key.spkiBase64, status = status)
}

internal object TestTool {
  const val ID = "sample"
  const val VERSION = "1.2.3"
  const val BYTECODE_VERSION = 96
  const val ASSET = "assets/data.json"
  val BYTECODE = "not really hermes bytecode".toByteArray()
  val ASSET_DATA = "{\"notes\":[60,64,67]}".toByteArray()

  fun files(): List<ZipItem> = listOf(ZipItem(RULES.entryFile, BYTECODE), ZipItem(ASSET, ASSET_DATA))

  fun manifest(keyId: String, files: List<ZipItem> = files(), id: String = ID): JSONObject {
    val route = RULES.routePrefix + id
    val listed = JSONArray(
      files.map { JSONObject().put("path", it.name).put("sha256", sha256(it.data)).put("size", it.data.size) },
    )
    return JSONObject()
      .put("schema", RULES.schemaVersion)
      .put("id", id)
      .put("name", "Sample")
      .put("version", VERSION)
      .put("icon", id)
      .put("hostApi", JSONObject().put("major", 1).put("minMinor", 0))
      .put("host", JSONObject().put("minVersionCode", 10100).put("maxVersionCode", JSONObject.NULL).put("builtWith", "0.101.0"))
      .put(
        "runtime",
        JSONObject().put("hermesBytecodeVersion", BYTECODE_VERSION).put("reactNative", "0.88.1")
          .put("react", "19.3.0").put("reanimated", "4.7.2").put("worklets", "0.13.0"),
      )
      .put("entry", RULES.entryFile)
      .put("files", listed)
      .put("size", files.sumOf { it.data.size })
      .put("routes", JSONArray(listOf(route)))
      .put("homeTile", JSONObject().put("label", "Sample").put("route", route))
      .put("capabilities", JSONArray())
      .put("signature", JSONObject().put("alg", RULES.signatureAlg).put("keyId", keyId))
  }

  fun kbt(
    manifestBytes: ByteArray,
    signature: ByteArray,
    files: List<ZipItem> = files(),
  ): ByteArray =
    TestZip.write(listOf(ZipItem(RULES.manifestFile, manifestBytes), ZipItem(RULES.manifestSigFile, signature)) + files)

  fun signed(
    key: TestToolKey,
    manifest: JSONObject = manifest(key.keyId),
    files: List<ZipItem> = files(),
  ): ByteArray {
    val bytes = manifest.toString().toByteArray()
    return kbt(bytes, key.sign(bytes), files)
  }

  fun sha256(data: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(data).joinToString("") { "%02x".format(it) }
}

internal fun rejectionMessage(block: () -> Unit): String? =
  try {
    block()
    null
  } catch (error: ToolRejected) {
    error.message
  }

internal fun rejection(block: () -> Unit): ToolRejection? =
  try {
    block()
    null
  } catch (error: ToolRejected) {
    error.rejection
  }
