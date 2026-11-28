package com.kitbag.corenative.tools

internal object VerifiedToolHandoff {
  fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int) =
    nativeHandOff(toolId, bytecode, bytecodeVersion)

  fun drop(toolId: String): Boolean = nativeDrop(toolId)

  private external fun nativeHandOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int)

  private external fun nativeDrop(toolId: String): Boolean

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
