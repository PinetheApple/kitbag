import 'package:flutter/material.dart';

/// A single-line label that scales down instead of clipping when it would
/// overflow — e.g. large text scales meeting narrow preset tiles or segment
/// cells (spec §06 200% text-scale acceptance criterion). It never scales
/// *up*, so at normal sizes it renders identically to a plain [Text].
class ScaleDownLabel extends StatelessWidget {
  const ScaleDownLabel(this.data, {super.key, this.style, this.textAlign});

  final String data;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(data, textAlign: textAlign, style: style),
    );
  }
}
