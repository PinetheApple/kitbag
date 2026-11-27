package com.kitbag.corenative.tools

internal object VerifiedToolHandoff {
  fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int) =
    nativeHandOff(toolId, bytecode, bytecodeVersion)

  private external fun nativeHandOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int)

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
