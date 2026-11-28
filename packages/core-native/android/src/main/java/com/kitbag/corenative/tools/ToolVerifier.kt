package com.kitbag.corenative.tools

import com.kitbag.corenative.library.DurableFiles

internal class VerifiedTool(
  val id: String,
  val bytecode: ByteArray,
  val bytecodeVersion: Int,
  val manifest: ToolManifest,
  val manifestSha256: String,
)

internal class ToolVerifier(private val rules: ToolBundleRules, private val keys: ToolKeyRing) {
  private val manifests = ToolManifestParser(rules)

  fun verify(kbt: ByteArray, expectedId: String, use: ToolKeyUse): VerifiedTool {
    val entries = ToolZip.read(kbt, rules.inflatedMaxBytes)
    val manifestBytes = single(entries, rules.manifestFile)
    val signature = single(entries, rules.manifestSigFile)
    val json = manifests.parse(manifestBytes)
    val keyId = manifests.signingKeyId(json)
    val key = keys.signer(keyId, use)
      ?: reject(ToolRejection.UNTRUSTED_KEY, "signed by $keyId, which is not a pinned, unrevoked tool key for $use")
    if (!keys.verify(manifestBytes, signature, key)) {
      reject(ToolRejection.SIGNATURE, "${rules.manifestSigFile} does not verify with $keyId")
    }
    val manifest = manifests.validate(json)
    if (manifest.id != expectedId) reject(ToolRejection.WRONG_TOOL, "the bundle is ${manifest.id}, not $expectedId")
    checkFiles(entries, manifest)
    val bytecode = entries.first { it.name == rules.entryFile }.data
    return VerifiedTool(manifest.id, bytecode, manifest.bytecodeVersion, manifest, DurableFiles.sha256(manifestBytes))
  }

  private fun single(entries: List<ToolZipEntry>, name: String): ByteArray {
    val found = entries.filter { it.name == name }
    if (found.isEmpty()) reject(ToolRejection.FILES, "no $name")
    if (found.size > 1) reject(ToolRejection.FILES, "$name appears twice")
    return found.single().data
  }

  private fun checkFiles(entries: List<ToolZipEntry>, manifest: ToolManifest) {
    val listed = manifest.files.associateBy { it.path }
    val seen = mutableSetOf<String>()
    for (entry in entries) {
      if (!seen.add(entry.name)) reject(ToolRejection.FILES, "${entry.name} appears twice")
      val signedFile = entry.name == rules.manifestFile || entry.name == rules.manifestSigFile
      if (!signedFile && entry.name !in listed) reject(ToolRejection.FILES, "${entry.name} is not listed in the manifest")
    }
    for (file in manifest.files) {
      val data = entries.firstOrNull { it.name == file.path }?.data
        ?: reject(ToolRejection.FILES, "${file.path} is missing")
      if (data.size.toLong() != file.size) reject(ToolRejection.FILES, "${file.path} size does not match the manifest")
      if (DurableFiles.sha256(data) != file.sha256) reject(ToolRejection.FILES, "${file.path} sha256 does not match the manifest")
    }
  }
}
