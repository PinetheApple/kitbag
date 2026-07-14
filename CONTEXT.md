# Kitbag

## Language

**core_services**:
A package that owns concrete Riverpod provider definitions for infrastructure services (audio engine, metronome controller, tuner controller, database). Exists so `core_plugin_api` remains purely abstract — tools and `app_shell` consume providers from `core_services` without pulling native FFI or SQLite deps through the abstract contract layer.
_Avoid_: core_plugin_api (that's the abstract contract), shared_services (the old file name)
