/// Absolute locations for navigation between the metronome's screens.
/// The routes themselves are declared relative (nested) in
/// `MetronomePlugin.routes` so back navigation walks up the stack.
abstract final class MetronomeRoutes {
  static const String metronome = '/metronome';
  static const String setlists = '/metronome/setlists';

  static String setlist(int id) => '$setlists/$id';
}
