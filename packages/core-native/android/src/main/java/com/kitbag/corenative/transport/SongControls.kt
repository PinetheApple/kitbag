package com.kitbag.corenative.transport

interface SongEngine {
  fun execute(command: SongCommand)

  fun position(): Long

  fun playing(): Boolean
}

class SongControls(private val engine: SongEngine, private val fence: CardFence) {
  sealed interface Outcome {
    data object Dropped : Outcome

    data object Stopped : Outcome

    data class Ran(val expected: SongProgress) : Outcome
  }

  fun press(
    cardNumber: Int,
    transport: SongTransport,
    progress: () -> SongProgress,
    action: SongAction,
    app: ((SongCommand) -> Unit)?,
  ): Outcome =
    fence.run(cardNumber) {
      val route = transport.route(progress(), action, app != null)
      route.app?.let { app?.invoke(it) }
      if (route.engine.any { it.endsSong }) {
        route.engine.forEach(engine::execute)
        Outcome.Stopped
      } else {
        runCommands(transport, progress, route.engine)
      }
    } ?: Outcome.Dropped

  fun seek(
    cardNumber: Int,
    transport: SongTransport,
    progress: () -> SongProgress,
    positionMillis: Long,
    app: ((SongCommand) -> Unit)?,
  ): Outcome =
    fence.run(cardNumber) {
      val route = transport.seekRoute(progress(), positionMillis, app != null)
      route.app?.let { app?.invoke(it) }
      runCommands(transport, progress, route.engine)
    } ?: Outcome.Dropped

  private fun runCommands(transport: SongTransport, progress: () -> SongProgress, commands: List<SongCommand>): Outcome {
    var expected = progress()
    for (command in commands) {
      engine.execute(command)
      expected = transport.applied(expected, command)
    }
    return Outcome.Ran(expected)
  }
}
