package com.kitbag.corenative

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import com.kitbag.corenative.transport.MetronomeSession
import com.kitbag.corenative.transport.TransportAction
import com.kitbag.corenative.transport.TransportView
import com.kitbag.corenative.transport.mediaArtist

internal class MetronomeCard(
  private val context: Context,
  private val openSession: () -> MediaSessionCompat,
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
      openSession().setMetadata(
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
      .setActions(MetronomeSession.ACTION_MASK)
    MetronomeSession.customActions(view.actions).forEach {
      builder.addCustomAction(it.name, label(it), icon(it))
    }
    openSession().setPlaybackState(builder.build())
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
      .setStyle(
        MediaStyle()
          .setMediaSession(openSession().sessionToken)
          .setShowActionsInCompactView(*MetronomeSession.compactSlots(view.actions)),
      )
      .apply { view.actions.forEach { addAction(icon(it), label(it), actionIntent(it)) } }
      .build()

  private fun label(action: TransportAction): String =
    context.getString(
      when (action) {
        TransportAction.PLAY -> R.string.kitbag_action_play
        TransportAction.PAUSE -> R.string.kitbag_action_pause
        TransportAction.STOP -> R.string.kitbag_action_stop
        TransportAction.TEMPO_DOWN -> R.string.kitbag_action_tempo_down
        TransportAction.TEMPO_UP -> R.string.kitbag_action_tempo_up
      },
    )

  private companion object {
    fun icon(action: TransportAction): Int =
      when (action) {
        TransportAction.PLAY -> R.drawable.kitbag_play
        TransportAction.PAUSE -> R.drawable.kitbag_pause
        TransportAction.STOP -> R.drawable.kitbag_stop
        TransportAction.TEMPO_DOWN -> R.drawable.kitbag_minus
        TransportAction.TEMPO_UP -> R.drawable.kitbag_plus
      }
  }
}
