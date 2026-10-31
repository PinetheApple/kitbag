package com.kitbag.corenative

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.kitbag.corenative.transport.TransportAction
import com.kitbag.corenative.transport.TransportView
import com.kitbag.corenative.transport.mediaArtist

internal class MetronomeCard(
  private val context: Context,
  private val session: MediaSessionCompat,
  private val channelId: String,
  private val launchIntent: PendingIntent?,
  private val actionIntent: (TransportAction) -> PendingIntent,
) {
  private var publishedMetadata: Pair<String, String?>? = null

  fun forgetMetadata() {
    publishedMetadata = null
  }

  fun publish(view: TransportView, playing: Boolean) {
    val metadata = view.title to view.subtitle
    if (metadata != publishedMetadata) {
      publishedMetadata = metadata
      session.setMetadata(
        MediaMetadataCompat.Builder()
          .putString(MediaMetadataCompat.METADATA_KEY_TITLE, metadata.first)
          .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, mediaArtist(metadata.second))
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
  }

  fun notification(view: TransportView, playing: Boolean): Notification =
    NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.kitbag_notification)
      .setContentTitle(view.title)
      .setContentText(mediaArtist(view.subtitle))
      .setContentIntent(launchIntent)
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
    RemoteViews(context.packageName, R.layout.kitbag_transport).apply {
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

  private fun label(action: TransportAction): String =
    context.getString(
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

  private companion object {
    val ACTION_SLOTS = listOf(
      R.id.kitbag_action_0,
      R.id.kitbag_action_1,
      R.id.kitbag_action_2,
      R.id.kitbag_action_3,
      R.id.kitbag_action_4,
      R.id.kitbag_action_5,
    )
    // System media cards draw only play/pause, skip and custom actions, so stop is custom too.
    val CUSTOM_ACTIONS =
      setOf(TransportAction.TEMPO_DOWN, TransportAction.TEMPO_UP, TransportAction.STOP)

    fun platformAction(action: TransportAction): Long =
      when (action) {
        TransportAction.PLAY -> PlaybackStateCompat.ACTION_PLAY
        TransportAction.PAUSE -> PlaybackStateCompat.ACTION_PAUSE
        TransportAction.STOP -> PlaybackStateCompat.ACTION_STOP
        TransportAction.PREVIOUS -> PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
        TransportAction.NEXT -> PlaybackStateCompat.ACTION_SKIP_TO_NEXT
        TransportAction.TEMPO_DOWN, TransportAction.TEMPO_UP -> 0L
      }

    fun icon(action: TransportAction): Int =
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
