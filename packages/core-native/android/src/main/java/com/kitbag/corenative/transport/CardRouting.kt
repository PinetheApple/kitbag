package com.kitbag.corenative.transport

enum class Card { NONE, METRONOME, SONG }

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
  data object MetronomeShow : CardEvent

  data class MetronomeTransport(val action: String?) : CardEvent

  data object MetronomeHide : CardEvent

  data object MetronomeStopped : CardEvent

  data object SongShow : CardEvent

  data class SongTapped(val action: String?) : CardEvent

  data object SongHide : CardEvent

  data object SongStopped : CardEvent

  data object Unrecognised : CardEvent

  data class SessionPress(val button: SessionButton) : CardEvent

  data class SessionSeek(val positionMillis: Long) : CardEvent

  data class SessionCustom(val action: String) : CardEvent
}

sealed interface CardEffect {
  data object None : CardEffect

  data object ShowMetronome : CardEffect

  data class Metronome(val action: TransportAction) : CardEffect

  data object ShowSong : CardEffect

  data class SongControl(val action: SongAction) : CardEffect

  data class SeekSong(val positionMillis: Long) : CardEffect

  data object EndSong : CardEffect

  data object RemoveCard : CardEffect
}

class CardRouting {
  var active: Card = Card.NONE
    private set

  private val songShowing: Boolean
    get() = active == Card.SONG

  fun on(event: CardEvent): CardEffect =
    when (event) {
      CardEvent.MetronomeShow -> if (songShowing) CardEffect.None else become(Card.METRONOME, CardEffect.ShowMetronome)
      is CardEvent.MetronomeTransport ->
        if (songShowing) CardEffect.None else metronome(event.action?.let(TransportAction::named))
      CardEvent.MetronomeHide -> if (songShowing) CardEffect.None else become(Card.NONE, CardEffect.RemoveCard)
      CardEvent.MetronomeStopped -> become(Card.NONE, CardEffect.RemoveCard)
      CardEvent.SongShow -> become(Card.SONG, CardEffect.ShowSong)
      is CardEvent.SongTapped ->
        if (songShowing) song(event.action?.let(SongAction::named)) else become(Card.NONE, CardEffect.RemoveCard)
      CardEvent.SongHide -> if (songShowing) become(Card.NONE, CardEffect.EndSong) else CardEffect.None
      CardEvent.SongStopped -> become(Card.NONE, CardEffect.EndSong)
      CardEvent.Unrecognised -> CardEffect.RemoveCard
      is CardEvent.SessionPress -> if (songShowing) song(event.button.song) else metronome(event.button.metronome)
      is CardEvent.SessionSeek -> if (songShowing) CardEffect.SeekSong(event.positionMillis) else CardEffect.None
      is CardEvent.SessionCustom ->
        if (songShowing) song(SongAction.named(event.action)) else metronome(TransportAction.named(event.action))
    }

  private fun become(card: Card, effect: CardEffect): CardEffect {
    active = card
    return effect
  }

  private fun metronome(action: TransportAction?): CardEffect =
    action?.let { CardEffect.Metronome(it) } ?: CardEffect.None

  private fun song(action: SongAction?): CardEffect =
    action?.let { CardEffect.SongControl(it) } ?: CardEffect.None
}
