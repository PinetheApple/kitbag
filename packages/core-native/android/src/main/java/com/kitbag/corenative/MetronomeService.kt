package com.kitbag.corenative

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
import android.view.View
import android.widget.RemoteViews
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.kitbag.corenative.transport.Playback
import com.kitbag.corenative.transport.PracticeClock
import com.kitbag.corenative.transport.TransportAction
import com.kitbag.corenative.transport.TransportCommand
import com.kitbag.corenative.transport.TransportModel
import com.kitbag.corenative.transport.TransportState
import com.kitbag.corenative.transport.TransportView

class MetronomeService : Service() {
  private var state: TransportState? = null
  private var model: TransportModel? = null
  private var lastStartId = 0
  private lateinit var session: MediaSessionCompat
  private var practice = PracticeClock.IDLE
  private var publishedMetadata: Pair<String, String?>? = null
  private val clock = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    running = true
    createChannel()
    session = MediaSessionCompat(this, SESSION_TAG).apply {
      setCallback(SessionCallback())
      isActive = true
    }
  }

  override fun onDestroy() {
    running = false
    clock.removeCallbacks(tick)
    session.release()
    super.onDestroy()
  }

  // Not sticky: a restarted process has no engine, so there is nothing to resume.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    when (intent?.action) {
      ACTION_SHOW -> show(intent)
      ACTION_TRANSPORT ->
        intent.getStringExtra(EXTRA_ACTION)?.let { handle(TransportAction.valueOf(it)) }
      else -> finish()
    }
    return START_NOT_STICKY
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
      setlist = null,
    )
    render()
  }

  private fun handle(action: TransportAction) {
    val transportModel = model ?: return
    val current = state?.let(::withEngineTempo) ?: return
    var next = current
    for (command in transportModel.commandsFor(current, action)) {
      execute(command)
      next = applied(next, command)
    }
    practice = practice.afterPlaying(next.playback == Playback.PLAYING, System.currentTimeMillis())
    state = next
    listener?.invoke(next, practice)
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
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification(view, s.playback == Playback.PLAYING),
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
    )
  }

  private fun notification(view: TransportView, playing: Boolean) =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.kitbag_notification)
      .setContentTitle(view.title)
      .setContentText(view.subtitle)
      .setContentIntent(launchIntent())
      .setOngoing(playing)
      .setDeleteIntent(actionIntent(TransportAction.STOP))
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setCustomContentView(transportViews(view))
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .build()

  // A media-style card always draws a seek bar, which the owner ruled out.
  private fun transportViews(view: TransportView): RemoteViews =
    RemoteViews(packageName, R.layout.kitbag_transport).apply {
      setTextViewText(R.id.kitbag_title, view.title)
      setTextViewText(R.id.kitbag_subtitle, view.subtitle)
      setViewVisibility(R.id.kitbag_subtitle, if (view.subtitle == null) View.GONE else View.VISIBLE)
      ACTION_SLOTS.forEachIndexed { slot, id ->
        val action = view.actions.getOrNull(slot)
        setViewVisibility(id, if (action == null) View.GONE else View.VISIBLE)
        if (action != null) {
          setImageViewResource(id, icon(action))
          setContentDescription(id, label(action))
          setOnClickPendingIntent(id, actionIntent(action))
        }
      }
    }

  private fun updateSession(s: TransportState, view: TransportView) {
    val playing = s.playback == Playback.PLAYING
    val metadata = view.title to view.subtitle
    if (metadata != publishedMetadata) {
      publishedMetadata = metadata
      session.setMetadata(
        MediaMetadataCompat.Builder()
          .putString(MediaMetadataCompat.METADATA_KEY_TITLE, metadata.first)
          .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, metadata.second)
          .build(),
      )
    }
    val builder = PlaybackStateCompat.Builder()
      .setState(
        if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
        PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
        0f,
      )
      .setActions(view.sessionActions.fold(0L) { mask, a -> mask or platformAction(a) })
    view.sessionActions.filter { it in CUSTOM_ACTIONS }.forEach {
      builder.addCustomAction(it.name, label(it), icon(it))
    }
    session.setPlaybackState(builder.build())
    clock.removeCallbacks(tick)
    if (playing) clock.postDelayed(tick, TICK_MILLIS)
  }

  private fun finish() {
    clock.removeCallbacks(tick)
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf(lastStartId)
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      getString(R.string.kitbag_metronome_channel),
      NotificationManager.IMPORTANCE_LOW,
    )
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
      Intent(this, MetronomeService::class.java)
        .setAction(ACTION_TRANSPORT)
        .putExtra(EXTRA_ACTION, action.name),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  private fun label(action: TransportAction): String =
    getString(
      when (action) {
        TransportAction.PLAY -> R.string.kitbag_action_play
        TransportAction.PAUSE -> R.string.kitbag_action_pause
        TransportAction.STOP -> R.string.kitbag_action_stop
        TransportAction.TEMPO_DOWN -> R.string.kitbag_action_tempo_down
        TransportAction.TEMPO_UP -> R.string.kitbag_action_tempo_up
        TransportAction.PREVIOUS -> R.string.kitbag_action_previous
        TransportAction.NEXT -> R.string.kitbag_action_next
      },
    )

  private inner class SessionCallback : MediaSessionCompat.Callback() {
    override fun onPlay() = handle(TransportAction.PLAY)

    override fun onPause() = handle(TransportAction.PAUSE)

    override fun onStop() = handle(TransportAction.STOP)

    override fun onSkipToPrevious() = handle(TransportAction.PREVIOUS)

    override fun onSkipToNext() = handle(TransportAction.NEXT)

    override fun onCustomAction(action: String, extras: Bundle?) =
      handle(TransportAction.valueOf(action))
  }

  companion object {
    private const val CHANNEL_ID = "kitbag_metronome"
    private const val NOTIFICATION_ID = 1
    private const val SESSION_TAG = "KitbagMetronome"
    private const val TICK_MILLIS = 1000L
    private const val ACTION_SHOW = "com.kitbag.corenative.SHOW"
    private const val ACTION_HIDE = "com.kitbag.corenative.HIDE"
    private const val ACTION_TRANSPORT = "com.kitbag.corenative.TRANSPORT"
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

    // System media cards draw only play/pause, skip and custom actions, so stop is custom too.
    private val ACTION_SLOTS = listOf(
      R.id.kitbag_action_0,
      R.id.kitbag_action_1,
      R.id.kitbag_action_2,
      R.id.kitbag_action_3,
      R.id.kitbag_action_4,
      R.id.kitbag_action_5,
    )
    private val CUSTOM_ACTIONS =
      setOf(TransportAction.TEMPO_DOWN, TransportAction.TEMPO_UP, TransportAction.STOP)

    @Volatile private var running = false

    @Volatile var listener: ((TransportState, PracticeClock) -> Unit)? = null

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
      val intent = Intent(context, MetronomeService::class.java)
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
      // An update to a live service needs no new foreground start, which Android 12+
      // refuses from the background.
      if (running) context.startService(intent)
      else ContextCompat.startForegroundService(context, intent)
    }

    // Queued behind any pending show, so the service is never stopped before it is foreground.
    fun hide(context: Context) {
      if (!running) return
      context.startService(Intent(context, MetronomeService::class.java).setAction(ACTION_HIDE))
    }

    private fun platformAction(action: TransportAction): Long =
      when (action) {
        TransportAction.PLAY -> PlaybackStateCompat.ACTION_PLAY
        TransportAction.PAUSE -> PlaybackStateCompat.ACTION_PAUSE
        TransportAction.STOP -> PlaybackStateCompat.ACTION_STOP
        TransportAction.PREVIOUS -> PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
        TransportAction.NEXT -> PlaybackStateCompat.ACTION_SKIP_TO_NEXT
        TransportAction.TEMPO_DOWN, TransportAction.TEMPO_UP -> 0L
      }

    private fun icon(action: TransportAction): Int =
      when (action) {
        TransportAction.PLAY -> R.drawable.kitbag_play
        TransportAction.PAUSE -> R.drawable.kitbag_pause
        TransportAction.STOP -> R.drawable.kitbag_stop
        TransportAction.TEMPO_DOWN -> R.drawable.kitbag_minus
        TransportAction.TEMPO_UP -> R.drawable.kitbag_plus
        TransportAction.PREVIOUS -> R.drawable.kitbag_previous
        TransportAction.NEXT -> R.drawable.kitbag_next
      }
  }
}
