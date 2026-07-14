import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _baseDirKey = 'base_directory';

final baseDirectoryFutureProvider = FutureProvider<String?>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_baseDirKey);
});

final settingsServiceProvider = Provider<SettingsService>((ref) {
  final db = ref.watch(kitbagDatabaseProvider);
  return SettingsService(db);
});

class SettingsService {
  SettingsService(this._db);

  final KitbagDatabase _db;

  Future<String> exportData() async {
    final dir = await _exportDir();
    final file = File('${dir.path}/kitbag_export.json');

    final setlists = await _db.setlistsDao.watchAll().first;
    final practiceSessions = await _db.practiceDao.watchAll().first;
    final librarySongs = await _db.librarySongsDao.watchAll().first;
    final tunings = await _db.tuningsDao.watchAll().first;
    final stemSets = await _db.stemsDao.watchSets().first;
    final export = <String, dynamic>{
      'version': 3,
      'setlists': [],
      'practiceSessions': practiceSessions.map((s) => <String, dynamic>{
        'startTime': s.startTime.toIso8601String(),
        'durationSeconds': s.durationSeconds,
        'avgBpm': s.avgBpm,
        if (s.setlistId != null) 'setlistId': s.setlistId,
        if (s.songsPlayed != null) 'songsPlayed': s.songsPlayed,
      }).toList(),
      'librarySongs': librarySongs.map((s) => <String, dynamic>{
        'title': s.title,
        'artist': s.artist,
        'filePath': s.filePath,
        'duration': s.duration,
        'format': s.format,
      }).toList(),
      'tunings': tunings.map((t) => <String, dynamic>{
        'name': t.name,
        'notes': t.notes.toList(),
      }).toList(),
      'stemSets': [],
    };

    for (final summary in setlists) {
      final songs = await _db.songsDao.getBySetlist(summary.setlist.id);
      final setlistJson = <String, dynamic>{
        'name': summary.setlist.name,
        'songs': songs
            .map(
              (s) => <String, dynamic>{
                'name': s.name,
                'bpm': s.bpm,
                'beatsPerBar': s.beatsPerBar,
                'subdivision': s.subdivision,
                'accents': s.accents.toList(),
                'polyEnabled': s.polyEnabled,
                'polyBeats': s.polyBeats,
                'sound': s.sound,
                'volume': s.volume,
                'latencyOffset': s.latencyOffset,
                'position': s.position,
              },
            )
            .toList(),
      };
      (export['setlists'] as List).add(setlistJson);
    }

    for (final summary in stemSets) {
      final stems = await _db.stemsDao.watchStems(summary.id).first;
      final stemSetJson = <String, dynamic>{
        'name': summary.name,
        'stems': stems
            .map(
              (s) => <String, dynamic>{
                'role': s.role,
                'filePath': s.filePath,
                'duration': s.duration,
                'format': s.format,
                'channelCount': s.channelCount,
                'sampleRate': s.sampleRate,
                'gain': s.gain,
                'sortOrder': s.sortOrder,
              },
            )
            .toList(),
      };
      (export['stemSets'] as List).add(stemSetJson);
    }

    await file.writeAsString(const JsonEncoder.withIndent('  ').convert(export));
    return file.path;
  }

  Future<Directory> _exportDir() async {
    // Android public Downloads — accessible to the user via file manager.
    const download = '/storage/emulated/0/Download';
    if (Directory(download).existsSync()) {
      return Directory(download);
    }
    return getApplicationDocumentsDirectory();
  }

  Future<String> importData() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
    );

    if (result == null || result.files.single.path == null) {
      throw const FormatException('No file selected');
    }

    final file = File(result.files.single.path!);
    final contents = await file.readAsString();
    final data = json.decode(contents) as Map<String, dynamic>;

    final version = data['version'] as int?;
    if (version == null || version < 1 || version > 3) {
      throw const FormatException('Unsupported export version');
    }

    final setlists = data['setlists'] as List<dynamic>;
    var imported = 0;

    for (final slJson in setlists) {
      final sl = slJson as Map<String, dynamic>;
      final setlistId = await _db.setlistsDao.create(sl['name'] as String);

      final songs = sl['songs'] as List<dynamic>;
      for (final songJson in songs) {
        final s = songJson as Map<String, dynamic>;
        final accentCodes = (s['accents'] as List<dynamic>)
            .map((c) => BeatAccent.values.firstWhere((a) => a.code == c))
            .toList();

        await _db.songsDao.append(
          setlistId: setlistId,
          name: s['name'] as String,
          bpm: (s['bpm'] as num).toDouble(),
          beatsPerBar: s['beatsPerBar'] as int,
          subdivision: s['subdivision'] as int,
          accents: Uint8List.fromList(accentCodes.map((a) => a.code).toList()),
          polyEnabled: s['polyEnabled'] as bool,
          polyBeats: s['polyBeats'] as int,
          sound: s['sound'] as int,
          volume: (s['volume'] as num?)?.toDouble() ?? 1.0,
          latencyOffset: (s['latencyOffset'] as num?)?.toDouble() ?? 0.0,
        );
        imported++;
      }
    }

    var practiceImported = 0;
    if (data['practiceSessions'] case final sessions? when sessions is List) {
      for (final s in sessions) {
        final session = s as Map<String, dynamic>;
        await _db.practiceDao.create(
          startTime: DateTime.parse(session['startTime'] as String),
          durationSeconds: session['durationSeconds'] as int,
          avgBpm: (session['avgBpm'] as num).toDouble(),
          setlistId: session['setlistId'] as int?,
          songsPlayed: session['songsPlayed'] as String?,
        );
        practiceImported++;
      }
    }

    // v3+ data
    if (version >= 3) {
      if (data['librarySongs'] case final songsList? when songsList is List) {
        for (final s in songsList) {
          final song = s as Map<String, dynamic>;
          await _db.librarySongsDao.create(
            title: song['title'] as String,
            artist: song['artist'] as String,
            filePath: song['filePath'] as String,
            duration: (song['duration'] as num).toDouble(),
            format: song['format'] as String,
          );
        }
      }

      if (data['tunings'] case final tuningsList? when tuningsList is List) {
        for (final t in tuningsList) {
          final tuning = t as Map<String, dynamic>;
          final notes = (tuning['notes'] as List<dynamic>).map((n) => n as int).toList();
          await _db.tuningsDao.create(
            tuning['name'] as String,
            Uint8List.fromList(notes),
          );
        }
      }

      if (data['stemSets'] case final setsList? when setsList is List) {
        for (final ss in setsList) {
          final set = ss as Map<String, dynamic>;
          final setId = await _db.stemsDao.createSet(
            name: set['name'] as String,
          );
          if (set['stems'] case final stemsList? when stemsList is List) {
            for (final st in stemsList) {
              final stem = st as Map<String, dynamic>;
              await _db.stemsDao.createStem(
                stemSetId: setId,
                role: stem['role'] as String,
                filePath: stem['filePath'] as String,
                duration: (stem['duration'] as num).toDouble(),
                format: stem['format'] as String,
                channelCount: (stem['channelCount'] as num?)?.toInt() ?? 2,
                sampleRate: (stem['sampleRate'] as num?)?.toInt() ?? 44100,
                sortOrder: (stem['sortOrder'] as num?)?.toInt() ?? 0,
              );
            }
          }
        }
      }
    }

    return 'Imported ${setlists.length} setlist(s) with $imported song(s) and $practiceImported practice session(s)';
  }

  Future<void> setBaseDirectory(String path) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseDirKey, path);
  }

  Future<void> pickBaseDirectory() async {
    final result = await FilePicker.platform.getDirectoryPath();
    if (result != null) {
      await setBaseDirectory(result);
    }
  }
}
