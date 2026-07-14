import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';

/// Reads a .kwav sidecar file and renders a waveform bar display.
class WaveformPainter extends CustomPainter {
  WaveformPainter(this._peaks, {this.positionFraction = 0, this.color, this.progressColor, this.backgroundColor});

  final List<List<PeakPair>> _peaks;
  final double positionFraction;
  final Color? color;
  final Color? progressColor;
  final Color? backgroundColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (_peaks.isEmpty) return;

    final bg = backgroundColor ?? Colors.grey.shade900;
    canvas.drawRect(Offset.zero & size, Paint()..color = bg);

    final barColor = color ?? Colors.blue;
    final progColor = progressColor ?? barColor.withAlpha(180);

    final barWidth = size.width / _peaks.length;
    final centerY = size.height / 2;

    for (int i = 0; i < _peaks.length; i++) {
      final ch0 = _peaks[i][0];
      final top = centerY - ch0.max * centerY;
      final bottom = centerY - ch0.min * centerY;
      final paint = Paint()
          ..color = i / _peaks.length <= positionFraction ? progColor : barColor;
      final x = i * barWidth;
      canvas.drawLine(
        Offset(x + barWidth / 2, top),
        Offset(x + barWidth / 2, bottom),
        paint..strokeWidth = barWidth * 0.8,
      );
    }
  }

  @override
  bool shouldRepaint(WaveformPainter old) =>
      old.positionFraction != positionFraction || old._peaks != _peaks;

  /// Load peaks from a .kwav file. Returns empty list on failure.
  static List<List<PeakPair>> load(String path, {int maxChunks = 2000}) {
    try {
      final file = File(path);
      if (!file.existsSync()) return [];
      final bytes = file.readAsBytesSync();
      if (bytes.length < 20) return [];
      // Format: magic(4), version(4), channels(4), total_frames(8), chunks(4), data(...)
      final data = ByteData.sublistView(bytes);
      final chunkCount = data.getUint32(16, Endian.little);
      final channels = data.getUint32(8, Endian.little);
      if (chunkCount == 0 || channels == 0) return [];

      final step = (chunkCount / maxChunks).ceil();
      final result = <List<PeakPair>>[];
      for (int c = 0; c < chunkCount; c += step) {
        final row = <PeakPair>[];
        for (int ch = 0; ch < channels; ch++) {
          final idx = 20 + (c * channels + ch) * 4;
          if (idx + 3 >= bytes.length) break;
          final min = data.getInt16(idx, Endian.little) / 32767.0;
          final max = data.getInt16(idx + 2, Endian.little) / 32767.0;
          row.add(PeakPair(min, max));
        }
        result.add(row);
      }
      return result;
    } catch (_) {
      return [];
    }
  }
}

class PeakPair {
  final double min;
  final double max;
  PeakPair(this.min, this.max);
}
