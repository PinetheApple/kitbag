package com.kitbag.corenative

import com.kitbag.corenative.transport.MetronomeEngine
import com.kitbag.corenative.transport.TransportCommand

internal object EngineMetronome : MetronomeEngine {
  override fun execute(command: TransportCommand) {
    when (command) {
      TransportCommand.Start, TransportCommand.Resume -> EngineTransport.start()
      TransportCommand.Pause -> EngineTransport.pause()
      TransportCommand.Stop -> EngineTransport.stop()
      is TransportCommand.SetTempo -> EngineTransport.setTempo(command.bpm)
    }
  }
}
