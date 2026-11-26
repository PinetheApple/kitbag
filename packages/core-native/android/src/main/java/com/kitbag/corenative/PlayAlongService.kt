package com.kitbag.corenative

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

internal data class PlayAlongCard(val app: String, val title: String?, val playing: Boolean)

internal enum class PlayAlongCardAction(val wire: String) {
  PLAY_PAUSE("playPause"),
  STOP("stop");

  companion object {
    fun named(name: String?): PlayAlongCardAction? = entries.find { it.name == name }
  }
}

class PlayAlongService : Service() {
  private val surface = ServiceCardSurface(this, NOTIFICATION_ID)
  private var lastStartId = 0

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    CardNotifications.createChannels(this)
    Log.i(LOG_TAG, "service started")
  }

  override fun onDestroy() {
    starts.stopped()
    Log.i(LOG_TAG, "service stopped")
    super.onDestroy()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    when (intent?.action) {
      ACTION_SHOW -> post(intent)
      ACTION_REQUEST -> request(PlayAlongCardAction.named(intent.getStringExtra(EXTRA_ACTION)))
      ACTION_HIDE -> finish()
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    requestListener?.invoke(PlayAlongCardAction.STOP)
    EngineTransport.endPlayAlong()
    finish()
    super.onTaskRemoved(rootIntent)
  }

  private fun post(intent: Intent) {
    starts.running = true
    val notification = notification(
      PlayAlongCard(
        app = intent.getStringExtra(EXTRA_APP).orEmpty(),
        title = intent.getStringExtra(EXTRA_TITLE),
        playing = intent.getBooleanExtra(EXTRA_PLAYING, false),
      ),
    )
    surface.promote(notification)?.let {
      Log.w(LOG_TAG, "Play along card posted without the foreground", it)
      surface.notify(notification)
    }
  }

  // With no app listening there is no follow left to end, so Stop silences the click itself.
  private fun request(action: PlayAlongCardAction?) {
    when (action) {
      PlayAlongCardAction.STOP -> {
        requestListener?.invoke(action) ?: EngineTransport.endPlayAlong()
        finish()
      }
      PlayAlongCardAction.PLAY_PAUSE -> requestListener?.invoke(action)
      null -> Unit
    }
  }

  private fun finish() {
    starts.stopped()
    surface.remove()
    stopSelf(lastStartId)
  }

  private fun notification(card: PlayAlongCard): Notification {
    val toggle = if (card.playing) R.string.kitbag_action_pause else R.string.kitbag_action_play
    val toggleIcon = if (card.playing) R.drawable.kitbag_pause else R.drawable.kitbag_play
    return NotificationCompat.Builder(this, CardNotifications.METRONOME_CHANNEL_ID)
      .setSmallIcon(R.drawable.kitbag_notification)
      .setContentTitle(getString(R.string.kitbag_play_along_title, card.app))
      .setContentText(card.title.orEmpty())
      .setContentIntent(CardNotifications.launchIntent(this))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .addAction(toggleIcon, getString(toggle), requestIntent(PlayAlongCardAction.PLAY_PAUSE))
      .addAction(R.drawable.kitbag_stop, getString(R.string.kitbag_action_stop), requestIntent(PlayAlongCardAction.STOP))
      .build()
  }

  private fun requestIntent(action: PlayAlongCardAction): PendingIntent =
    PendingIntent.getService(
      this,
      action.ordinal,
      Intent(this, PlayAlongService::class.java)
        .setAction(ACTION_REQUEST)
        .putExtra(EXTRA_ACTION, action.name),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  companion object {
    private const val NOTIFICATION_ID = 4
    private const val LOG_TAG = "KitbagPlayAlong"
    private const val ACTION_SHOW = "com.kitbag.corenative.PLAY_ALONG_SHOW"
    private const val ACTION_HIDE = "com.kitbag.corenative.PLAY_ALONG_HIDE"
    private const val ACTION_REQUEST = "com.kitbag.corenative.PLAY_ALONG_REQUEST"
    private const val EXTRA_APP = "app"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_PLAYING = "playing"
    private const val EXTRA_ACTION = "action"

    private val starts = ForegroundStarts(LOG_TAG)

    internal val following: Boolean
      get() = starts.running

    @Volatile internal var requestListener: ((PlayAlongCardAction) -> Unit)? = null

    internal fun show(context: Context, card: PlayAlongCard) {
      val intent = Intent(context, PlayAlongService::class.java)
        .setAction(ACTION_SHOW)
        .putExtra(EXTRA_APP, card.app)
        .putExtra(EXTRA_TITLE, card.title)
        .putExtra(EXTRA_PLAYING, card.playing)
      starts.start(context, intent)
    }

    fun hide(context: Context) {
      if (!starts.live) return
      context.startService(Intent(context, PlayAlongService::class.java).setAction(ACTION_HIDE))
    }
  }
}
