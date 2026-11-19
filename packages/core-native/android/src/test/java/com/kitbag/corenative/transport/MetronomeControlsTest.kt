package com.kitbag.corenative.transport

import com.kitbag.corenative.transport.TransportAction.PAUSE
import com.kitbag.corenative.transport.TransportAction.STOP
import com.kitbag.corenative.transport.TransportAction.TEMPO_DOWN
import com.kitbag.corenative.transport.TransportAction.TEMPO_UP
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MetronomeControlsTest {
  private class FakeEngine : MetronomeEngine {
    val calls: MutableList<Any> = Collections.synchronizedList(mutableListOf())
    var onExecute: () -> Unit = {}

    override fun execute(command: TransportCommand) {
      onExecute()
      calls += command
    }
  }

  private val engine = FakeEngine()
  private val fences = CardFences()
  private val controls = MetronomeControls(engine, fences.metronome)
  private val model = TransportModel(minBpm = 20.0, maxBpm = 400.0)
  private val playing = TransportState(
    Playback.PLAYING,
    bpm = 120.0,
    rampRunning = false,
    beatsPerBar = 4,
    beatUnit = 4,
    subtitle = null,
  )

  private fun press(card: Int, action: TransportAction) = controls.press(card, model, playing, action)

  @Test
  fun `a pause on the shown card pauses the engine`() {
    val card = fences.metronome.keep()
    assertEquals(Playback.PAUSED, press(card, PAUSE)?.playback)
    assertEquals(listOf(TransportCommand.Pause), engine.calls)
  }

  @Test
  fun `pause, stop and tempo steps after a withdraw reach no engine command`() {
    val card = fences.metronome.keep()
    fences.metronome.withdraw()
    for (action in listOf(PAUSE, STOP, TEMPO_UP, TEMPO_DOWN)) assertNull(press(card, action))
    assertEquals(emptyList<Any>(), engine.calls)
  }

  @Test
  fun `a press on an older card still runs while the app shows a metronome card`() {
    val older = fences.metronome.keep()
    fences.metronome.keep()
    assertEquals(Playback.PAUSED, press(older, PAUSE)?.playback)
    assertEquals(listOf(TransportCommand.Pause), engine.calls)
  }

  @Test
  fun `withdrawing the song card leaves metronome presses running`() {
    val card = fences.metronome.keep()
    fences.song.issue()
    fences.song.withdraw()
    assertEquals(Playback.PAUSED, press(card, PAUSE)?.playback)
  }

  @Test
  fun `between the hand over and its hide, pause, stop and tempo steps queue nothing`() {
    val card = fences.metronome.keep()
    val pressed = mutableListOf<TransportState?>()
    fences.handOverMetronome {
      for (action in listOf(PAUSE, STOP, TEMPO_UP, TEMPO_DOWN)) pressed += press(card, action)
    }
    assertEquals(listOf(null, null, null, null), pressed)
    assertEquals(emptyList<Any>(), engine.calls)
  }

  @Test
  fun `a pause that beat the hand over queues before anything the app sends after it`() {
    val card = fences.metronome.keep()
    val inBody = CountDownLatch(1)
    val proceed = CountDownLatch(1)
    engine.onExecute = {
      inBody.countDown()
      proceed.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)
    }
    val pausing = Thread { press(card, PAUSE) }.apply { start() }
    assertTrue(inBody.await(TIMEOUT_SECONDS, TimeUnit.SECONDS))
    val handingOver = Thread {
      fences.handOverMetronome {}
      engine.calls += APP_CLICK_START
    }.apply { start() }
    awaitBlockedOrDone(handingOver)
    proceed.countDown()
    pausing.join(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))
    handingOver.join(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))
    assertEquals(listOf(TransportCommand.Pause, APP_CLICK_START), engine.calls)
  }

  private fun awaitBlockedOrDone(thread: Thread) {
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(TIMEOUT_SECONDS)
    while (thread.state != Thread.State.BLOCKED && thread.state != Thread.State.TERMINATED) {
      check(System.nanoTime() < deadline) { "hand over neither blocked nor finished" }
      Thread.yield()
    }
  }

  private companion object {
    const val APP_CLICK_START = "app click start"
    const val TIMEOUT_SECONDS = 5L
  }
}
