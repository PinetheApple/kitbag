package com.kitbag.corenative.tools

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

internal class ToolJob {
  private val stop = CountDownLatch(1)

  val cancelled: Boolean get() = stop.count == 0L

  fun cancel() = stop.countDown()

  fun pause(ms: Long): Boolean = !stop.await(ms, TimeUnit.MILLISECONDS)
}

internal class ToolInstallStopped(val receivedBytes: Long) : Exception("the install was stopped")
