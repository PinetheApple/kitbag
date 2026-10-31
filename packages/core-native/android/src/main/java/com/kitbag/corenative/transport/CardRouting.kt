package com.kitbag.corenative.transport

enum class SessionButton(val song: SongAction?, val metronome: TransportAction?) {
  PLAY(SongAction.PLAY, TransportAction.PLAY),
  PAUSE(SongAction.PAUSE, TransportAction.PAUSE),
  STOP(SongAction.STOP, TransportAction.STOP),
  PREVIOUS(null, TransportAction.PREVIOUS),
  NEXT(null, TransportAction.NEXT),
  REWIND(SongAction.REWIND, null),
  FAST_FORWARD(SongAction.FORWARD, null),
}

sealed interface CardEvent {
  data object MetronomeShown : CardEvent

  data class MetronomeTapped(val action: String?) : CardEvent

  data object MetronomeHidden : CardEvent

  data object MetronomeStopped : CardEvent

  data object SongShown : CardEvent

  data class SongTapped(val action: String?) : CardEvent

  data object SongHidden : CardEvent

  data object SongStopped : CardEvent

  data object StartUnrecognised : CardEvent

  data class SessionPressed(val button: SessionButton) : CardEvent

  data class SessionSeeked(val positionMillis: Long) : CardEvent

  data class SessionCustomPressed(val action: String) : CardEvent
}

sealed interface CardEffect {
  data object None : CardEffect

  data object ShowMetronome : CardEffect

  data object HoldMetronome : CardEffect

  data class MetronomeControl(val action: TransportAction) : CardEffect

  data object ShowSong : CardEffect

  data class SongControl(val action: SongAction) : CardEffect

  data class SeekSong(val positionMillis: Long) : CardEffect

  data object EndSong : CardEffect

  data object ReturnToMetronome : CardEffect

  data object RemoveCard : CardEffect
}

class CardRouting {
  private var songShowing = false
  private var metronomeShowing = false

  fun on(event: CardEvent): CardEffect =
    when {
      songShowing -> whileSong(event)
      metronomeShowing -> whileMetronome(event)
      else -> withoutCard(event)
    }

  private fun whileSong(event: CardEvent): CardEffect =
    when (event) {
      CardEvent.MetronomeShown -> metronomeShown(CardEffect.HoldMetronome)
      is CardEvent.MetronomeTapped -> CardEffect.None
      CardEvent.MetronomeHidden, CardEvent.MetronomeStopped -> metronomeEnded(CardEffect.None)
      CardEvent.SongShown -> CardEffect.ShowSong
      is CardEvent.SongTapped -> song(event.action?.let(SongAction::named))
      CardEvent.SongHidden, CardEvent.SongStopped -> songEnded()
      CardEvent.StartUnrecognised -> CardEffect.None
      is CardEvent.SessionPressed -> song(event.button.song)
      is CardEvent.SessionSeeked -> CardEffect.SeekSong(event.positionMillis)
      is CardEvent.SessionCustomPressed -> song(SongAction.named(event.action))
    }

  private fun whileMetronome(event: CardEvent): CardEffect =
    when (event) {
      CardEvent.MetronomeShown -> CardEffect.ShowMetronome
      is CardEvent.MetronomeTapped -> metronome(event.action?.let(TransportAction::named))
      CardEvent.MetronomeHidden, CardEvent.MetronomeStopped -> metronomeEnded(CardEffect.RemoveCard)
      CardEvent.SongShown -> songStarted()
      is CardEvent.SongTapped -> CardEffect.None
      CardEvent.SongHidden, CardEvent.SongStopped -> CardEffect.None
      CardEvent.StartUnrecognised -> CardEffect.None
      is CardEvent.SessionPressed -> metronome(event.button.metronome)
      is CardEvent.SessionSeeked -> CardEffect.None
      is CardEvent.SessionCustomPressed -> metronome(TransportAction.named(event.action))
    }

  private fun withoutCard(event: CardEvent): CardEffect =
    when (event) {
      CardEvent.MetronomeShown -> metronomeShown(CardEffect.ShowMetronome)
      CardEvent.SongShown -> songStarted()
      else -> CardEffect.RemoveCard
    }

  private fun metronomeShown(effect: CardEffect): CardEffect {
    metronomeShowing = true
    return effect
  }

  private fun metronomeEnded(effect: CardEffect): CardEffect {
    metronomeShowing = false
    return effect
  }

  private fun songStarted(): CardEffect {
    songShowing = true
    return CardEffect.ShowSong
  }

  private fun songEnded(): CardEffect {
    songShowing = false
    return if (metronomeShowing) CardEffect.ReturnToMetronome else CardEffect.EndSong
  }

  private fun metronome(action: TransportAction?): CardEffect =
    action?.let { CardEffect.MetronomeControl(it) } ?: CardEffect.None

  private fun song(action: SongAction?): CardEffect =
    action?.let { CardEffect.SongControl(it) } ?: CardEffect.None
}
