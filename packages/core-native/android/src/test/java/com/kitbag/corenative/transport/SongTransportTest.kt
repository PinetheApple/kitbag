package com.kitbag.corenative.transport

import android.support.v4.media.session.PlaybackStateCompat
import com.kitbag.corenative.transport.SongAction.FORWARD
import com.kitbag.corenative.transport.SongAction.PAUSE
import com.kitbag.corenative.transport.SongAction.PLAY
import com.kitbag.corenative.transport.SongAction.REWIND
import com.kitbag.corenative.transport.SongAction.STOP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SongTransportTest {
  private val rate = 48_000.0
  private val song = Song(
    title = "Blackbird",
    artist = "The Beatles",
    durationFrames = 180 * 48_000L,
    restartFromFrame = 180 * 48_000L - 12_000L,
    skipSeconds = 10.0,
  )
  private val transport = SongTransport(song, rate)

  private fun at(seconds: Double, playing: Boolean = true) =
    SongProgress(playing, (seconds * rate).toLong())

  @Test
  fun `media artist is the artist given`() {
    assertEquals("The Beatles", mediaArtist("The Beatles"))
  }

  @Test
  fun `media artist is empty, never null, when there is none`() {
    assertEquals("", mediaArtist(null))
    assertEquals("", mediaArtist("  "))
  }

  @Test
  fun `length is the song's frames in milliseconds`() {
    assertEquals(180_000L, transport.durationMillis)
  }

  @Test
  fun `card shows back, play or pause, forward and stop`() {
    assertEquals(listOf(REWIND, PAUSE, FORWARD, STOP), transport.actions(at(5.0)))
    assertEquals(listOf(REWIND, PLAY, FORWARD, STOP), transport.actions(at(5.0, playing = false)))
  }

  @Test
  fun `playing publishes position, speed one, the read time and a seekable action set`() {
    val playback = transport.playback(at(61.5), now = 1_000L)
    assertEquals(PlaybackStateCompat.STATE_PLAYING, playback.state)
    assertEquals(61_500L, playback.positionMillis)
    assertEquals(1f, playback.speed)
    assertEquals(1_000L, playback.updatedAt)
    for (action in listOf(
      PlaybackStateCompat.ACTION_SEEK_TO,
      PlaybackStateCompat.ACTION_PLAY_PAUSE,
      PlaybackStateCompat.ACTION_STOP,
    )) {
      assertEquals(action, playback.actions and action)
    }
  }

  @Test
  fun `paused holds the position with speed zero`() {
    val playback = transport.playback(at(30.0, playing = false), now = 1_000L)
    assertEquals(PlaybackStateCompat.STATE_PAUSED, playback.state)
    assertEquals(30_000L, playback.positionMillis)
    assertEquals(0f, playback.speed)
    assertEquals(30_000L, playback.positionAt(now = 9_000L))
  }

  @Test
  fun `a published position extrapolates at speed one`() {
    assertEquals(12_500L, transport.playback(at(10.0), now = 1_000L).positionAt(now = 3_500L))
  }

  @Test
  fun `steady playback is not republished, a loop wrap or seek is`() {
    val published = transport.playback(at(10.0), now = 0L)
    assertFalse(transport.stale(published, at(12.0), now = 2_000L))
    assertTrue(transport.stale(published, at(4.0), now = 2_000L))
    assertTrue(transport.stale(published, at(40.0), now = 2_000L))
  }

  @Test
  fun `a pause or resume the app made is republished`() {
    assertTrue(transport.stale(transport.playback(at(10.0), now = 0L), at(10.0, playing = false), now = 0L))
    assertTrue(transport.stale(null, at(10.0), now = 0L))
  }

  @Test
  fun `skips move ten seconds and clamp to the song`() {
    assertEquals(listOf(SongCommand.Seek(at(40.0).positionFrames)), transport.commandsFor(at(30.0), FORWARD))
    assertEquals(listOf(SongCommand.Seek(at(20.0).positionFrames)), transport.commandsFor(at(30.0), REWIND))
    assertEquals(listOf(SongCommand.Seek(0L)), transport.commandsFor(at(4.0), REWIND))
    assertEquals(listOf(SongCommand.Seek(song.durationFrames)), transport.commandsFor(at(175.0), FORWARD))
  }

  @Test
  fun `play resumes in place, or from the top once at the end`() {
    assertEquals(listOf(SongCommand.Play), transport.commandsFor(at(30.0, playing = false), PLAY))
    val atEnd = SongProgress(playing = false, positionFrames = song.restartFromFrame)
    assertEquals(listOf(SongCommand.Seek(0L), SongCommand.Play), transport.commandsFor(atEnd, PLAY))
    assertEquals(emptyList<SongCommand>(), transport.commandsFor(at(30.0), PLAY))
  }

  @Test
  fun `pause holds, and only while playing`() {
    assertEquals(listOf(SongCommand.Pause), transport.commandsFor(at(30.0), PAUSE))
    assertEquals(emptyList<SongCommand>(), transport.commandsFor(at(30.0, playing = false), PAUSE))
  }

  @Test
  fun `stop always ends playback`() {
    assertEquals(listOf(SongCommand.Stop), transport.commandsFor(at(30.0, playing = false), STOP))
  }

  @Test
  fun `dragging the bar seeks to that point, clamped to the song`() {
    assertEquals(SongCommand.Seek(at(90.0).positionFrames), transport.seekTo(90_000L))
    assertEquals(SongCommand.Seek(song.durationFrames), transport.seekTo(999_000L))
    assertEquals(SongCommand.Seek(0L), transport.seekTo(-1L))
  }

  @Test
  fun `a command's effect is assumed before the engine reports it`() {
    val paused = at(30.0, playing = false)
    assertEquals(at(30.0), transport.applied(paused, SongCommand.Play))
    assertEquals(paused, transport.applied(at(30.0), SongCommand.Pause))
    assertEquals(SongProgress(false, 0L), transport.applied(at(30.0), SongCommand.Stop))
    assertEquals(at(5.0), transport.applied(at(30.0), SongCommand.Seek(at(5.0).positionFrames)))
  }

  @Test
  fun `named finds an action and ignores an unknown name`() {
    assertEquals(FORWARD, SongAction.named("FORWARD"))
    assertNull(SongAction.named("TEMPO_UP"))
  }

  private fun counting(seconds: Double) = SongProgress(false, (seconds * rate).toLong(), countingIn = true)

  @Test
  fun `a count-in shows pause and plays nothing on the system clock`() {
    assertEquals(listOf(REWIND, PAUSE, FORWARD, STOP), transport.actions(counting(5.0)))
    val playback = transport.playback(counting(5.0), now = 1_000L)
    assertEquals(PlaybackStateCompat.STATE_PLAYING, playback.state)
    assertEquals(0f, playback.speed)
  }

  @Test
  fun `a count-in sends every action to the app and leaves the engine alone`() {
    val expected = mapOf(
      PLAY to SongCommand.Play,
      PAUSE to SongCommand.Pause,
      REWIND to SongCommand.Seek(0L),
      FORWARD to SongCommand.Seek(15 * 48_000L),
    )
    for ((action, command) in expected) {
      assertEquals(SongRoute(command, emptyList()), transport.route(counting(5.0), action, appListening = true))
    }
    assertEquals(
      SongRoute(SongCommand.Seek(2 * 48_000L), emptyList()),
      transport.seekRoute(counting(5.0), 2_000L, appListening = true),
    )
  }

  @Test
  fun `stop during a count-in tells the app and ends the count and the song natively`() {
    assertEquals(
      SongRoute(SongCommand.Stop, listOf(SongCommand.StopCountIn)),
      transport.route(counting(5.0), STOP, appListening = true),
    )
  }

  @Test
  fun `only stops end the song`() {
    assertTrue(SongCommand.Stop.endsSong)
    assertTrue(SongCommand.StopCountIn.endsSong)
    assertFalse(SongCommand.Pause.endsSong)
    assertFalse(SongCommand.Seek(0L).endsSong)
  }

  @Test
  fun `without the count-in marker the engine keeps every action`() {
    for (progress in listOf(at(5.0), at(5.0, playing = false))) {
      for (action in SongAction.entries) {
        assertEquals(
          SongRoute(null, transport.commandsFor(progress, action)),
          transport.route(progress, action, appListening = true),
        )
      }
    }
    assertEquals(
      SongRoute(null, listOf(SongCommand.Seek(2 * 48_000L))),
      transport.seekRoute(at(5.0), 2_000L, appListening = true),
    )
  }

  @Test
  fun `a count-in with no app listening stays with the engine`() {
    assertEquals(SongRoute(null, emptyList()), transport.route(counting(5.0), PAUSE, appListening = false))
    assertEquals(
      SongRoute(null, listOf(SongCommand.StopCountIn)),
      transport.route(counting(5.0), STOP, appListening = false),
    )
  }

  @Test
  fun `a plain playing show never routes to the app`() {
    val shown = at(5.0, playing = false).shown(playing = true, countingIn = false)
    assertFalse(shown.countingIn)
    assertTrue(shown.shownPlaying)
    assertNull(transport.route(shown, PAUSE, appListening = true).app)
  }

  @Test
  fun `a count-in show keeps the mixer's own playing state`() {
    val shown = at(5.0, playing = false).shown(playing = true, countingIn = true)
    assertFalse(shown.playing)
    assertTrue(shown.countingIn)
  }

  @Test
  fun `requests name their action for the app`() {
    assertEquals(
      listOf("play", "pause", "stop", "seek"),
      listOf(SongCommand.Play, SongCommand.Pause, SongCommand.Stop, SongCommand.Seek(1L)).map { it.appAction },
    )
  }
}
