package com.kitbag.corenative.transport

import com.kitbag.corenative.transport.SongAction.NEXT
import com.kitbag.corenative.transport.SongAction.PLAY
import com.kitbag.corenative.transport.SongAction.PREVIOUS
import com.kitbag.corenative.transport.SongAction.STOP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SongControlsTest {
  private class FakeEngine : SongEngine {
    val calls = mutableListOf<SongCommand>()
    var head = 0L
    var playing = false

    override fun execute(command: SongCommand) {
      calls += command
    }

    override fun position(): Long = head

    override fun playing(): Boolean = playing
  }

  private val rate = 48_000.0
  private val songA = Song(
    title = "A",
    artist = null,
    durationFrames = 180 * 48_000L,
    restartFromFrame = 180 * 48_000L - 12_000L,
    skipSeconds = 10.0,
  )
  private val songB = Song(
    title = "B",
    artist = null,
    durationFrames = 30 * 48_000L,
    restartFromFrame = 30 * 48_000L - 12_000L,
    skipSeconds = 10.0,
  )
  private val engine = FakeEngine()
  private val fence = CardFence()
  private val controls = SongControls(engine, fence)
  private val requests = mutableListOf<SongCommand>()
  private val app: (SongCommand) -> Unit = { requests += it }

  private fun progress(countingIn: Boolean = false) = SongProgress(engine.playing(), engine.position(), countingIn)

  private fun press(cardNumber: Int, song: Song, action: SongAction, countingIn: Boolean = false) =
    controls.press(cardNumber, SongTransport(song, rate), { progress(countingIn) }, action, app)

  @Test
  fun `a play on the shown card plays`() {
    val card = fence.issue()
    assertTrue(press(card, songA, PLAY) is SongControls.Outcome.Ran)
    assertEquals(listOf(SongCommand.Play), engine.calls)
  }

  @Test
  fun `a play between the withdraw and the next show reaches neither the engine nor the app`() {
    val cardA = fence.issue()
    engine.head = songA.restartFromFrame
    fence.withdraw()
    assertEquals(SongControls.Outcome.Dropped, press(cardA, songA, PLAY))
    assertEquals(SongControls.Outcome.Dropped, press(cardA, songA, STOP))
    val seek = controls.seek(cardA, SongTransport(songA, rate), { progress() }, 0L, app)
    assertEquals(SongControls.Outcome.Dropped, seek)
    assertEquals(emptyList<SongCommand>(), engine.calls)
    assertEquals(emptyList<SongCommand>(), requests)
  }

  @Test
  fun `once the next song shows, the old card stays dropped and the new card plays`() {
    val cardA = fence.issue()
    fence.withdraw()
    val cardB = fence.issue()
    assertEquals(SongControls.Outcome.Dropped, press(cardA, songA, PLAY))
    assertEquals(emptyList<SongCommand>(), engine.calls)
    press(cardB, songB, PLAY)
    assertEquals(listOf(SongCommand.Play), engine.calls)
  }

  @Test
  fun `a count-in press on a withdrawn card is not forwarded to the app`() {
    val cardA = fence.issue()
    fence.withdraw()
    assertEquals(SongControls.Outcome.Dropped, press(cardA, songA, PLAY, countingIn = true))
    assertEquals(emptyList<SongCommand>(), requests)
  }

  @Test
  fun `a count-in press on the shown card goes to the app and leaves the engine alone`() {
    val card = fence.issue()
    press(card, songA, PLAY, countingIn = true)
    assertEquals(listOf<SongCommand>(SongCommand.Play), requests)
    assertEquals(emptyList<SongCommand>(), engine.calls)
  }

  @Test
  fun `a next on the shown card goes to the app and leaves the engine alone`() {
    val card = fence.issue()
    engine.playing = true
    assertTrue(press(card, songA, NEXT) is SongControls.Outcome.Ran)
    assertEquals(listOf<SongCommand>(SongCommand.Next), requests)
    assertEquals(emptyList<SongCommand>(), engine.calls)
  }

  @Test
  fun `a next or previous from a card the next song replaced is dropped`() {
    val cardA = fence.issue()
    fence.issue()
    assertEquals(SongControls.Outcome.Dropped, press(cardA, songA, NEXT))
    assertEquals(SongControls.Outcome.Dropped, press(cardA, songA, PREVIOUS))
    assertEquals(emptyList<SongCommand>(), requests)
    assertEquals(emptyList<SongCommand>(), engine.calls)
  }

  @Test
  fun `a previous on the shown card restarts the song`() {
    val card = fence.issue()
    engine.head = 95 * 48_000L
    press(card, songA, PREVIOUS)
    assertEquals(listOf<SongCommand>(SongCommand.Seek(0L)), engine.calls)
  }

  @Test
  fun `a stop on the shown card stops the engine and reports the song stopped`() {
    val card = fence.issue()
    assertEquals(SongControls.Outcome.Stopped, press(card, songA, STOP))
    assertEquals(listOf<SongCommand>(SongCommand.Stop), engine.calls)
  }
}
