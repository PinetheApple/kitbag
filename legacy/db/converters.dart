import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:drift/drift.dart';

class BeatAccentConverter extends TypeConverter<List<BeatAccent>, Uint8List> {
  const BeatAccentConverter();

  @override
  List<BeatAccent> fromSql(Uint8List from) => [
    for (final code in from)
      BeatAccent.values.firstWhere(
        (accent) => accent.code == code,
        orElse: () => BeatAccent.normal,
      ),
  ];

  @override
  Uint8List toSql(List<BeatAccent> value) =>
      Uint8List.fromList([for (final accent in value) accent.code]);
}
