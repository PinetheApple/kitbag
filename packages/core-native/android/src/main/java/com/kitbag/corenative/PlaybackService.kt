package com.kitbag.corenative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.session.MediaSessionCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.kitbag.corenative.transport.Playback
import com.kitbag.corenative.transport.PracticeClock
import com.kitbag.corenative.transport.SetlistPosition
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongAction
import com.kitbag.corenative.transport.TransportAction
import com.kitbag.corenative.transport.TransportCommand
import com.kitbag.corenative.transport.TransportModel
import com.kitbag.corenative.transport.TransportState
import com.kitbag.corenative.transport.TransportView

class PlaybackService : Service() {
  private var state: TransportState? = null
  private var model: TransportModel? = null
  private var lastStartId = 0
  private lateinit var session: MediaSessionCompat
  private var practice = PracticeClock.IDLE
  private lateinit var card: MetronomeCard
  private var song: SongCard? = null
  private val clock = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    running = true
    createChannel(CHANNEL_ID, R.string.kitbag_metronome_channel)
    createChannel(SONG_CHANNEL_ID, R.string.kitbag_songs_channel)
    session = MediaSessionCompat(this, SESSION_TAG).apply {
      setCallback(SessionCallback())
      isActive = true
    }
    card = MetronomeCard(this, session, CHANNEL_ID, launchIntent(), ::actionIntent)
  }

  override fun onDestroy() {
    running = false
    startRequested = false
    clock.removeCallbacks(tick)
    song?.release()
    session.release()
    super.onDestroy()
  }

  // Not sticky: a restarted process has no engine, so there is nothing to resume.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    val songShowing = song != null
    when (intent?.action) {
      ACTION_SHOW -> if (!songShowing) show(intent)
      ACTION_TRANSPORT -> if (!songShowing) {
        intent.getStringExtra(EXTRA_ACTION)?.let(TransportAction::named)?.let(::handle)
      }
      ACTION_HIDE -> if (!songShowing) finish()
      ACTION_SONG_SHOW -> showSong(intent)
      ACTION_SONG -> songTapped(intent)
      ACTION_SONG_HIDE -> if (songShowing) endSong()
      else -> finish()
    }
    return START_NOT_STICKY
  }

  private fun songTapped(intent: Intent) {
    val songCard = song ?: return finish()
    intent.getStringExtra(EXTRA_ACTION)?.let(SongAction::named)?.let(songCard::handle)
  }

  private fun showSong(intent: Intent) {
    clock.removeCallbacks(tick)
    state = null
    model = null
    card.forgetMetadata()
    val next = Song(
      title = intent.getStringExtra(EXTRA_TITLE).orEmpty(),
      artist = intent.getStringExtra(EXTRA_ARTIST),
      durationFrames = intent.getLongExtra(EXTRA_DURATION_FRAMES, 0L),
      restartFromFrame = intent.getLongExtra(EXTRA_RESTART_FROM_FRAME, 0L),
      skipSeconds = intent.getDoubleExtra(EXTRA_SKIP_SECONDS, 0.0),
    )
    val songCard = song ?: SongCard(
      this,
      session,
      SONG_CHANNEL_ID,
      launchIntent(),
      ::songIntent,
      ::postForeground,
      ::endSong,
    ).also { song = it }
    songCard.show(next, intent.getBooleanExtra(EXTRA_PLAYING, true))
  }

  private fun endSong() {
    song?.release()
    song = null
    finish()
  }

  private fun postForeground(notification: Notification) {
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
    )
  }

  private fun show(intent: Intent) {
    model = TransportModel(
      intent.getDoubleExtra(EXTRA_MIN_BPM, 0.0),
      intent.getDoubleExtra(EXTRA_MAX_BPM, 0.0),
    )
    val playing = intent.getBooleanExtra(EXTRA_PLAYING, true)
    practice = PracticeClock(
      intent.getLongExtra(EXTRA_PRACTICE_PLAYED_MS, 0L),
      if (playing) intent.getLongExtra(EXTRA_PRACTICE_STRETCH_STARTED_AT, System.currentTimeMillis()) else null,
    )
    state = TransportState(
      playback = if (playing) Playback.PLAYING else Playback.PAUSED,
      bpm = intent.getDoubleExtra(EXTRA_BPM, 0.0),
      rampRunning = intent.getBooleanExtra(EXTRA_RAMP_RUNNING, false),
      beatsPerBar = intent.getIntExtra(EXTRA_BEATS_PER_BAR, 0),
      beatUnit = intent.getIntExtra(EXTRA_BEAT_UNIT, 0),
      setlist = SetlistPosition.from(
        intent.getStringExtra(EXTRA_SETLIST_NAME),
        intent.getStringExtra(EXTRA_SONG_TITLE),
        intent.getIntExtra(EXTRA_SONG_INDEX, 0),
        intent.getIntExtra(EXTRA_SONG_COUNT, 0),
      ),
    )
    render()
  }

  private fun handle(action: TransportAction) {
    val transportModel = model ?: return
    val current = state?.let(::withEngineTempo) ?: return
    var next = current
    val commands = transportModel.commandsFor(current, action)
    for (command in commands) {
      execute(command)
      next = applied(next, command)
    }
    val songStep = action.takeIf {
      TransportCommand.PreviousSong in commands || TransportCommand.NextSong in commands
    }
    practice = practice.afterPlaying(next.playback == Playback.PLAYING, System.currentTimeMillis())
    state = next
    listener?.invoke(next, practice, songStep)
    if (next.playback == Playback.STOPPED) finish() else render()
  }

  // A running ramp moves the tempo without telling the service, so read it live.
  private fun withEngineTempo(s: TransportState): TransportState =
    if (s.playback == Playback.PLAYING) s.copy(bpm = EngineTransport.currentBpm()) else s

  private fun execute(command: TransportCommand) {
    when (command) {
      TransportCommand.Start, TransportCommand.Resume -> EngineTransport.start()
      TransportCommand.Pause -> EngineTransport.pause()
      TransportCommand.Stop -> EngineTransport.stop()
      is TransportCommand.SetTempo -> EngineTransport.setTempo(command.bpm)
      TransportCommand.PreviousSong, TransportCommand.NextSong -> Unit
    }
  }

  private fun applied(s: TransportState, command: TransportCommand): TransportState =
    when (command) {
      TransportCommand.Start, TransportCommand.Resume -> s.copy(playback = Playback.PLAYING)
      TransportCommand.Pause -> s.copy(playback = Playback.PAUSED)
      TransportCommand.Stop -> s.copy(playback = Playback.STOPPED)
      is TransportCommand.SetTempo -> s.copy(bpm = command.bpm, rampRunning = false)
      TransportCommand.PreviousSong, TransportCommand.NextSong -> s
    }

  private fun onTick() {
    val transportModel = model ?: return
    val previous = state ?: return
    val current = withEngineTempo(previous)
    state = current
    val view = transportModel.view(current)
    if (view.title != transportModel.view(previous).title) render() else updateSession(current, view)
  }

  private fun render() {
    val s = state ?: return
    val view = model?.view(s) ?: return
    updateSession(s, view)
    postForeground(card.notification(view, s.playback == Playback.PLAYING))
  }


  private fun updateSession(s: TransportState, view: TransportView) {
    val playing = s.playback == Playback.PLAYING
    card.publish(view, playing)
    clock.removeCallbacks(tick)
    if (playing) clock.postDelayed(tick, TICK_MILLIS)
  }

  private fun finish() {
    clock.removeCallbacks(tick)
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf(lastStartId)
  }

  private fun createChannel(id: String, name: Int) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(id, getString(name), NotificationManager.IMPORTANCE_LOW)
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun launchIntent(): PendingIntent? =
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }

  private fun actionIntent(action: TransportAction): PendingIntent =
    PendingIntent.getService(
      this,
      action.ordinal,
      Intent(this, PlaybackService::class.java)
        .setAction(ACTION_TRANSPORT)
        .putExtra(EXTRA_ACTION, action.name),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  private fun songIntent(action: SongAction): PendingIntent =
    PendingIntent.getService(
      this,
      action.ordinal,
      Intent(this, PlaybackService::class.java)
        .setAction(ACTION_SONG)
        .putExtra(EXTRA_ACTION, action.name),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  private inner class SessionCallback : MediaSessionCompat.Callback() {
    override fun onPlay() = route(SongAction.PLAY, TransportAction.PLAY)

    override fun onPause() = route(SongAction.PAUSE, TransportAction.PAUSE)

    override fun onStop() = route(SongAction.STOP, TransportAction.STOP)

    override fun onSkipToPrevious() = handle(TransportAction.PREVIOUS)

    override fun onSkipToNext() = handle(TransportAction.NEXT)

    override fun onRewind() {
      song?.handle(SongAction.REWIND)
    }

    override fun onFastForward() {
      song?.handle(SongAction.FORWARD)
    }

    override fun onSeekTo(pos: Long) {
      song?.seekTo(pos)
    }

    override fun onCustomAction(action: String, extras: Bundle?) {
      val songCard = song
      if (songCard == null) {
        TransportAction.named(action)?.let(::handle)
      } else {
        SongAction.named(action)?.let(songCard::handle)
      }
    }

    private fun route(songAction: SongAction, transportAction: TransportAction) {
      val songCard = song
      if (songCard == null) {
        handle(transportAction)
      } else {
        songCard.handle(songAction)
      }
    }
  }

  companion object {
    private const val CHANNEL_ID = "kitbag_metronome"
    private const val NOTIFICATION_ID = 1
    private const val SESSION_TAG = "KitbagMetronome"
    private const val TICK_MILLIS = 1000L
    private const val ACTION_SHOW = "com.kitbag.corenative.SHOW"
    private const val ACTION_HIDE = "com.kitbag.corenative.HIDE"
    private const val ACTION_TRANSPORT = "com.kitbag.corenative.TRANSPORT"
    private const val ACTION_SONG_SHOW = "com.kitbag.corenative.SONG_SHOW"
    private const val ACTION_SONG_HIDE = "com.kitbag.corenative.SONG_HIDE"
    private const val ACTION_SONG = "com.kitbag.corenative.SONG"
    private const val SONG_CHANNEL_ID = "kitbag_songs"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_ARTIST = "artist"
    private const val EXTRA_DURATION_FRAMES = "durationFrames"
    private const val EXTRA_RESTART_FROM_FRAME = "restartFromFrame"
    private const val EXTRA_SKIP_SECONDS = "skipSeconds"
    private const val EXTRA_ACTION = "action"
    private const val EXTRA_BPM = "bpm"
    private const val EXTRA_RAMP_RUNNING = "rampRunning"
    private const val EXTRA_BEATS_PER_BAR = "beatsPerBar"
    private const val EXTRA_BEAT_UNIT = "beatUnit"
    private const val EXTRA_MIN_BPM = "minBpm"
    private const val EXTRA_MAX_BPM = "maxBpm"
    private const val EXTRA_PLAYING = "playing"
    private const val EXTRA_PRACTICE_PLAYED_MS = "practicePlayedMs"
    private const val EXTRA_PRACTICE_STRETCH_STARTED_AT = "practiceStretchStartedAt"
    private const val EXTRA_SETLIST_NAME = "setlistName"
    private const val EXTRA_SONG_TITLE = "songTitle"
    private const val EXTRA_SONG_INDEX = "songIndex"
    private const val EXTRA_SONG_COUNT = "songCount"

    @Volatile private var running = false

    @Volatile private var startRequested = false

    @Volatile var listener: ((TransportState, PracticeClock, TransportAction?) -> Unit)? = null

    fun show(
      context: Context,
      state: TransportState,
      minBpm: Double,
      maxBpm: Double,
      practicePlayedMs: Long,
      practiceStretchStartedAt: Long,
    ) {
      val playing = state.playback == Playback.PLAYING
      if (!running && !playing) return
      val intent = Intent(context, PlaybackService::class.java)
        .setAction(ACTION_SHOW)
        .putExtra(EXTRA_PLAYING, playing)
        .putExtra(EXTRA_BPM, state.bpm)
        .putExtra(EXTRA_RAMP_RUNNING, state.rampRunning)
        .putExtra(EXTRA_BEATS_PER_BAR, state.beatsPerBar)
        .putExtra(EXTRA_BEAT_UNIT, state.beatUnit)
        .putExtra(EXTRA_MIN_BPM, minBpm)
        .putExtra(EXTRA_MAX_BPM, maxBpm)
        .putExtra(EXTRA_PRACTICE_PLAYED_MS, practicePlayedMs)
        .putExtra(EXTRA_PRACTICE_STRETCH_STARTED_AT, practiceStretchStartedAt)
      state.setlist?.let {
        intent
          .putExtra(EXTRA_SETLIST_NAME, it.setlistName)
          .putExtra(EXTRA_SONG_TITLE, it.songTitle)
          .putExtra(EXTRA_SONG_INDEX, it.index)
          .putExtra(EXTRA_SONG_COUNT, it.songCount)
      }
      start(context, intent)
    }

    // Sent while a show's start is still pending too: it queues behind that show, so no card is left stuck.
    fun hide(context: Context) {
      if (!running && !startRequested) return
      context.startService(Intent(context, PlaybackService::class.java).setAction(ACTION_HIDE))
    }

    fun showSong(context: Context, song: Song, playing: Boolean) {
      val intent = Intent(context, PlaybackService::class.java)
        .setAction(ACTION_SONG_SHOW)
        .putExtra(EXTRA_PLAYING, playing)
        .putExtra(EXTRA_TITLE, song.title)
        .putExtra(EXTRA_ARTIST, song.artist)
        .putExtra(EXTRA_DURATION_FRAMES, song.durationFrames)
        .putExtra(EXTRA_RESTART_FROM_FRAME, song.restartFromFrame)
        .putExtra(EXTRA_SKIP_SECONDS, song.skipSeconds)
      start(context, intent)
    }

    fun hideSong(context: Context) {
      if (!running && !startRequested) return
      context.startService(Intent(context, PlaybackService::class.java).setAction(ACTION_SONG_HIDE))
    }

    // An update to a live service needs no new foreground start, which Android 12+
    // refuses from the background.
    private fun start(context: Context, intent: Intent) {
      if (running) {
        context.startService(intent)
      } else {
        ContextCompat.startForegroundService(context, intent)
        startRequested = true
      }
    }
  }
}
