package com.kitbag.corenative

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.session.MediaSessionCompat
import android.util.Log
import com.kitbag.corenative.transport.CardEffect
import com.kitbag.corenative.transport.CardEvent
import com.kitbag.corenative.transport.CardFence
import com.kitbag.corenative.transport.CardFences
import com.kitbag.corenative.transport.CardPoster
import com.kitbag.corenative.transport.CardRouting
import com.kitbag.corenative.transport.MetronomeControls
import com.kitbag.corenative.transport.MetronomeEngine
import com.kitbag.corenative.transport.Playback
import com.kitbag.corenative.transport.PracticeClock
import com.kitbag.corenative.transport.SessionButton
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongAction
import com.kitbag.corenative.transport.SongCardTag
import com.kitbag.corenative.transport.SongCommand
import com.kitbag.corenative.transport.SongOrder
import com.kitbag.corenative.transport.TransportAction
import com.kitbag.corenative.transport.TransportChange
import com.kitbag.corenative.transport.TransportCommand
import com.kitbag.corenative.transport.TransportModel
import com.kitbag.corenative.transport.TransportState
import com.kitbag.corenative.transport.TransportView

class PlaybackService : Service() {
  private var state: TransportState? = null
  private var model: TransportModel? = null
  private var lastStartId = 0
  private var session: MediaSessionCompat? = null
  private var practice = PracticeClock.IDLE
  private var shownCardNumber = 0
  private var metronomeCardNumber = CardFence.NONE
  private val metronomeControls = MetronomeControls(EngineMetronome, fences.metronome)
  private lateinit var card: MetronomeCard
  private var song: SongCard? = null
  private val routing = CardRouting()
  private val poster = CardPoster(ServiceCardSurface(this, NOTIFICATION_ID)) {
    Log.w(LOG_TAG, "Playing card posted without the foreground", it)
  }
  private val clock = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    starts.running = true
    CardNotifications.createChannels(this)
    card = MetronomeCard(
      this,
      ::openSession,
      CardNotifications.METRONOME_CHANNEL_ID,
      CardNotifications.launchIntent(this),
      ::actionIntent,
    )
  }

  override fun onDestroy() {
    starts.stopped()
    clock.removeCallbacks(tick)
    song?.release()
    poster.finish()
    releaseSession()
    super.onDestroy()
  }

  // Not sticky: a restarted process has no engine, so there is nothing to resume.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    perform(routing.on(event(intent)), intent)
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    route(CardEvent.TaskRemoved)
    EngineTransport.stop()
    EngineTransport.mixerStop()
    super.onTaskRemoved(rootIntent)
  }

  private fun event(intent: Intent?): CardEvent =
    when (intent?.action) {
      ACTION_SHOW -> CardEvent.MetronomeShown
      ACTION_TRANSPORT -> CardEvent.MetronomeTapped(intent.getStringExtra(EXTRA_ACTION))
      ACTION_HIDE -> CardEvent.MetronomeHidden
      ACTION_SONG_SHOW -> CardEvent.SongShown
      ACTION_SONG -> CardEvent.SongTapped(intent.getStringExtra(EXTRA_ACTION))
      ACTION_SONG_HIDE -> CardEvent.SongHidden
      ACTION_SONG_ORDER -> CardEvent.SongOrdered(SongOrder.named(intent.getStringExtra(EXTRA_SONG_ORDER)))
      ACTION_SONG_SEEKED -> CardEvent.SongSeekedInApp(intent.getLongExtra(EXTRA_POSITION_FRAMES, 0L))
      else -> CardEvent.StartUnrecognised
    }

  private fun perform(effect: CardEffect, intent: Intent?) {
    when (effect) {
      CardEffect.None -> Unit
      CardEffect.ShowMetronome -> intent?.let { show(it) }
      CardEffect.HoldMetronome -> intent?.let { hold(it) }
      is CardEffect.MetronomeControl -> handle(effect.action)
      CardEffect.ShowSong -> intent?.let { showSong(it) }
      is CardEffect.SongControl -> song?.handle(effect.action)
      is CardEffect.SeekSong -> song?.seekTo(effect.positionMillis)
      is CardEffect.OrderSong -> song?.order(effect.order)
      is CardEffect.PublishSongSeek -> song?.seekedInApp(effect.positionFrames)
      CardEffect.EndSong -> endSong()
      CardEffect.ReturnToMetronome -> returnToMetronome()
      CardEffect.RemoveCard -> finish()
      is CardEffect.StopPlayback -> stopPlayback(effect)
    }
    // The service can outlive its card while a queued start is pending, so the session ends with the card.
    if (!routing.cardShowing) releaseSession()
  }

  private fun route(event: CardEvent) = perform(routing.on(event), null)

  private fun showSong(intent: Intent) {
    clock.removeCallbacks(tick)
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
      ::openSession,
      CardNotifications.SONG_CHANNEL_ID,
      CardNotifications.launchIntent(this),
      ::songIntent,
      ::postSong,
      { songRequestListener },
      fences.song,
      { if (PlayAlongService.following) EngineTransport.stopPlayAlongClick() },
      { songStartedListener?.invoke() },
      { songEndedListener?.invoke() },
    ) { songStopped() }.also { song = it }
    songCard.show(
      next,
      SongCardTag(
        cardNumber = intent.getIntExtra(EXTRA_SONG_CARD, CardFence.NONE),
        session = intent.getIntExtra(EXTRA_SONG_SESSION, CardFence.NONE),
        followsPlayOrder = intent.getBooleanExtra(EXTRA_FOLLOWS_PLAY_ORDER, false),
        order = SongOrder.named(intent.getStringExtra(EXTRA_SONG_ORDER)),
      ),
      intent.getBooleanExtra(EXTRA_PLAYING, true),
      intent.getBooleanExtra(EXTRA_COUNTING_IN, false),
    )
  }

  private fun songStopped() {
    songStoppedListener?.invoke()
    route(CardEvent.SongStopped)
  }

  private fun endSong() {
    releaseSong()
    finish()
  }

  private fun returnToMetronome() {
    releaseSong()
    state = state?.let(::withEngineTempo)
    render()
  }

  // The cards' own Stop paths tell a still-live JS store, so a warm relaunch shows nothing playing.
  private fun stopPlayback(effect: CardEffect.StopPlayback) {
    if (effect.song) song?.handle(SongAction.STOP)
    if (effect.metronome) handle(TransportAction.STOP)
    releaseSong()
    finish()
  }

  private fun releaseSong() {
    song?.release()
    song = null
  }

  private fun postSong(notification: Notification, playing: Boolean, cardNumber: Int) =
    poster.post(notification, playing, fences.song, cardNumber)

  private fun show(intent: Intent) {
    hold(intent)
    render()
  }

  private fun hold(intent: Intent) {
    model = TransportModel(
      intent.getDoubleExtra(EXTRA_MIN_BPM, 0.0),
      intent.getDoubleExtra(EXTRA_MAX_BPM, 0.0),
    )
    val playback = Playback.wired(intent.getStringExtra(EXTRA_PLAYBACK))
    val playing = playback == Playback.PLAYING
    shownCardNumber = intent.getIntExtra(EXTRA_CARD_NUMBER, 0)
    metronomeCardNumber = intent.getIntExtra(EXTRA_METRONOME_CARD, CardFence.NONE)
    practice = PracticeClock(
      intent.getLongExtra(EXTRA_PRACTICE_PLAYED_MS, 0L),
      if (playing) intent.getLongExtra(EXTRA_PRACTICE_STRETCH_STARTED_AT, System.currentTimeMillis()) else null,
    )
    state = TransportState(
      playback = playback,
      bpm = intent.getDoubleExtra(EXTRA_BPM, 0.0),
      rampRunning = intent.getBooleanExtra(EXTRA_RAMP_RUNNING, false),
      beatsPerBar = intent.getIntExtra(EXTRA_BEATS_PER_BAR, 0),
      beatUnit = intent.getIntExtra(EXTRA_BEAT_UNIT, 0),
      subtitle = intent.getStringExtra(EXTRA_SUBTITLE),
    )
  }

  private fun handle(action: TransportAction) {
    val transportModel = model ?: return
    val current = state?.let(::withEngineTempo) ?: return
    val engineBpm = EngineTransport.currentBpm()
    val next = metronomeControls.press(metronomeCardNumber, transportModel, current, action) ?: return
    practice = practice.afterPlaying(next.playback == Playback.PLAYING, System.currentTimeMillis())
    state = next
    val step = transportModel.tempoStep(action)
    listener?.invoke(TransportChange(next, practice, shownCardNumber, action, step, engineBpm))
    if (transportModel.endsCard(action, next)) route(CardEvent.MetronomeStopped) else render()
  }

  // A running ramp moves the tempo without telling the service, so read it live.
  private fun withEngineTempo(s: TransportState): TransportState =
    if (s.playback == Playback.PLAYING) s.copy(bpm = EngineTransport.currentBpm()) else s

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
    val playing = s.playback == Playback.PLAYING
    poster.post(card.notification(view, playing), playing, fences.metronome, metronomeCardNumber)
  }

  private fun updateSession(s: TransportState, view: TransportView) {
    val playing = s.playback == Playback.PLAYING
    card.publish(view, playing)
    clock.removeCallbacks(tick)
    if (playing) clock.postDelayed(tick, TICK_MILLIS)
  }

  private fun finish() {
    clock.removeCallbacks(tick)
    poster.finish()
    stopSelf(lastStartId)
  }

  private fun openSession(): MediaSessionCompat =
    session ?: MediaSessionCompat(this, SESSION_TAG).apply {
      setCallback(SessionCallback())
      isActive = true
    }.also { session = it }

  private fun releaseSession() {
    val open = session ?: return
    session = null
    card.forgetMetadata()
    open.isActive = false
    open.release()
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
    override fun onPlay() = route(CardEvent.SessionPressed(SessionButton.PLAY))

    override fun onPause() = route(CardEvent.SessionPressed(SessionButton.PAUSE))

    override fun onStop() = route(CardEvent.SessionPressed(SessionButton.STOP))

    override fun onRewind() = route(CardEvent.SessionPressed(SessionButton.REWIND))

    override fun onFastForward() = route(CardEvent.SessionPressed(SessionButton.FAST_FORWARD))

    override fun onSkipToPrevious() = route(CardEvent.SessionPressed(SessionButton.PREVIOUS))

    override fun onSkipToNext() = route(CardEvent.SessionPressed(SessionButton.NEXT))

    override fun onSeekTo(pos: Long) = route(CardEvent.SessionSeeked(pos))

    override fun onCustomAction(action: String, extras: Bundle?) =
      route(CardEvent.SessionCustomPressed(action))
  }

  companion object {
    private const val NOTIFICATION_ID = 1
    private const val SESSION_TAG = "KitbagMetronome"
    private const val LOG_TAG = "KitbagPlayback"
    private const val TICK_MILLIS = 1000L
    private const val ACTION_SHOW = "com.kitbag.corenative.SHOW"
    private const val ACTION_HIDE = "com.kitbag.corenative.HIDE"
    private const val ACTION_TRANSPORT = "com.kitbag.corenative.TRANSPORT"
    private const val ACTION_SONG_SHOW = "com.kitbag.corenative.SONG_SHOW"
    private const val ACTION_SONG_HIDE = "com.kitbag.corenative.SONG_HIDE"
    private const val ACTION_SONG = "com.kitbag.corenative.SONG"
    private const val ACTION_SONG_ORDER = "com.kitbag.corenative.SONG_ORDER"
    private const val ACTION_SONG_SEEKED = "com.kitbag.corenative.SONG_SEEKED"
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
    private const val EXTRA_COUNTING_IN = "countingIn"
    private const val EXTRA_PLAYBACK = "playback"
    private const val EXTRA_SONG_SESSION = "songSession"
    private const val EXTRA_FOLLOWS_PLAY_ORDER = "followsPlayOrder"
    private const val EXTRA_SONG_ORDER = "songOrder"
    private const val EXTRA_POSITION_FRAMES = "positionFrames"
    private const val EXTRA_PRACTICE_PLAYED_MS = "practicePlayedMs"
    private const val EXTRA_PRACTICE_STRETCH_STARTED_AT = "practiceStretchStartedAt"
    private const val EXTRA_SUBTITLE = "setlistSubtitle"
    private const val EXTRA_CARD_NUMBER = "cardNumber"
    private const val EXTRA_SONG_CARD = "songCard"
    private const val EXTRA_METRONOME_CARD = "metronomeCard"
    private val fences = CardFences()

    private val starts = ForegroundStarts(LOG_TAG)

    @Volatile var listener: ((TransportChange) -> Unit)? = null

    @Volatile var songStoppedListener: (() -> Unit)? = null

    @Volatile var songEndedListener: (() -> Unit)? = null

    @Volatile var songStartedListener: (() -> Unit)? = null

    @Volatile var songRequestListener: ((SongCommand, Int) -> Unit)? = null

    @Volatile private var songOrder = SongOrder.ALONE

    fun show(
      context: Context,
      state: TransportState,
      minBpm: Double,
      maxBpm: Double,
      practicePlayedMs: Long,
      practiceStretchStartedAt: Long,
      cardNumber: Int,
    ) {
      val playing = state.playback == Playback.PLAYING
      if (!starts.running && !playing) return
      val intent = Intent(context, PlaybackService::class.java)
        .setAction(ACTION_SHOW)
        .putExtra(EXTRA_PLAYBACK, state.playback.wire)
        .putExtra(EXTRA_BPM, state.bpm)
        .putExtra(EXTRA_RAMP_RUNNING, state.rampRunning)
        .putExtra(EXTRA_BEATS_PER_BAR, state.beatsPerBar)
        .putExtra(EXTRA_BEAT_UNIT, state.beatUnit)
        .putExtra(EXTRA_MIN_BPM, minBpm)
        .putExtra(EXTRA_MAX_BPM, maxBpm)
        .putExtra(EXTRA_PRACTICE_PLAYED_MS, practicePlayedMs)
        .putExtra(EXTRA_PRACTICE_STRETCH_STARTED_AT, practiceStretchStartedAt)
        .putExtra(EXTRA_CARD_NUMBER, cardNumber)
        .putExtra(EXTRA_METRONOME_CARD, fences.showMetronome())
      state.subtitle?.let { intent.putExtra(EXTRA_SUBTITLE, it) }
      starts.start(context, intent)
    }

    // Sent while a show's start is still pending too: it queues behind that show, so no card is left stuck.
    fun hide(context: Context) =
      fences.hideMetronome {
        if (starts.live) {
          context.startService(Intent(context, PlaybackService::class.java).setAction(ACTION_HIDE))
        }
      }

    fun handOver(context: Context) = hide(context)

    fun showSong(
      context: Context,
      song: Song,
      session: Int,
      followsPlayOrder: Boolean,
      playing: Boolean,
      countingIn: Boolean,
    ) {
      val intent = Intent(context, PlaybackService::class.java)
        .setAction(ACTION_SONG_SHOW)
        .putExtra(EXTRA_SONG_SESSION, session)
        .putExtra(EXTRA_FOLLOWS_PLAY_ORDER, followsPlayOrder)
        .putExtra(EXTRA_SONG_ORDER, songOrder.name)
        .putExtra(EXTRA_PLAYING, playing)
        .putExtra(EXTRA_COUNTING_IN, countingIn)
        .putExtra(EXTRA_TITLE, song.title)
        .putExtra(EXTRA_ARTIST, song.artist)
        .putExtra(EXTRA_DURATION_FRAMES, song.durationFrames)
        .putExtra(EXTRA_RESTART_FROM_FRAME, song.restartFromFrame)
        .putExtra(EXTRA_SKIP_SECONDS, song.skipSeconds)
        .putExtra(EXTRA_SONG_CARD, fences.song.issue())
      starts.start(context, intent)
    }

    fun orderSong(context: Context, order: SongOrder) {
      songOrder = order
      if (!starts.live) return
      context.startService(
        Intent(context, PlaybackService::class.java)
          .setAction(ACTION_SONG_ORDER)
          .putExtra(EXTRA_SONG_ORDER, order.name),
      )
    }

    // The card reads the engine only on its tick, so a seek the app makes is published at once.
    fun seekedSong(context: Context, positionFrames: Long) {
      if (!starts.live) return
      context.startService(
        Intent(context, PlaybackService::class.java)
          .setAction(ACTION_SONG_SEEKED)
          .putExtra(EXTRA_POSITION_FRAMES, positionFrames),
      )
    }

    fun hideSong(context: Context) {
      fences.song.withdraw()
      if (!starts.live) return
      context.startService(Intent(context, PlaybackService::class.java).setAction(ACTION_SONG_HIDE))
    }

  }
}

private object EngineMetronome : MetronomeEngine {
  override fun execute(command: TransportCommand) {
    when (command) {
      TransportCommand.Start, TransportCommand.Resume -> EngineTransport.start()
      TransportCommand.Pause -> EngineTransport.pause()
      TransportCommand.Stop -> EngineTransport.stop()
      is TransportCommand.SetTempo -> EngineTransport.setTempo(command.bpm)
    }
  }
}
