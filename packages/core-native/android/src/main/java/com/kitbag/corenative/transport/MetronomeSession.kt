package com.kitbag.corenative.transport

import android.support.v4.media.session.PlaybackStateCompat

object MetronomeSession {
  const val ACTION_MASK =
    PlaybackStateCompat.ACTION_PLAY or
      PlaybackStateCompat.ACTION_PAUSE or
      PlaybackStateCompat.ACTION_PLAY_PAUSE or
      PlaybackStateCompat.ACTION_STOP

  private const val MAX_COMPACT_ACTIONS = 3

  // System media cards draw no stop or tempo button, so those are custom actions.
  private val CUSTOM_ACTIONS = setOf(TransportAction.TEMPO_DOWN, TransportAction.TEMPO_UP, TransportAction.STOP)

  fun customActions(actions: List<TransportAction>): List<TransportAction> =
    actions.filter { it in CUSTOM_ACTIONS }

  fun compactSlots(actions: List<TransportAction>): IntArray =
    actions.indices.filter { actions[it] != TransportAction.STOP }.take(MAX_COMPACT_ACTIONS).toIntArray()
}
