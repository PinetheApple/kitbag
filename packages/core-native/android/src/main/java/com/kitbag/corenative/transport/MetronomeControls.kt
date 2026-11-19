package com.kitbag.corenative.transport

interface MetronomeEngine {
  fun execute(command: TransportCommand)
}

class MetronomeControls(private val engine: MetronomeEngine, private val fence: CardFence) {
  fun press(
    cardNumber: Int,
    model: TransportModel,
    current: TransportState,
    action: TransportAction,
  ): TransportState? =
    fence.run(cardNumber) {
      model.commandsFor(current, action).fold(current) { next, command ->
        engine.execute(command)
        applied(next, command)
      }
    }

  private fun applied(s: TransportState, command: TransportCommand): TransportState =
    when (command) {
      TransportCommand.Start, TransportCommand.Resume -> s.copy(playback = Playback.PLAYING)
      TransportCommand.Pause -> s.copy(playback = Playback.PAUSED)
      TransportCommand.Stop -> s.copy(playback = Playback.STOPPED)
      is TransportCommand.SetTempo -> s.copy(bpm = command.bpm, rampRunning = false)
    }
}
