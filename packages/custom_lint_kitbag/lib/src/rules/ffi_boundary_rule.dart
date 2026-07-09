import 'package:analyzer/error/listener.dart';
import 'package:custom_lint_builder/custom_lint_builder.dart';

class FfiBoundaryRule extends DartLintRule {
  FfiBoundaryRule() : super(code: _code);

  static final _code = LintCode(
    name: 'kitbag_ffi_boundary',
    problemMessage: 'FFI imports are only allowed in core_audio_ffi',
    correctionMessage:
        'Move FFI bindings to packages/core_audio_ffi and expose a Dart API.',
  );

  @override
  void run(
    CustomLintResolver resolver,
    // ignore: deprecated_member_use
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    final sourcePath = resolver.source.uri.toString();
    if (sourcePath.contains('/packages/core_audio_ffi/')) return;

    context.registry.addImportDirective((node) {
      final uri = node.uri.stringValue;
      if (uri == null) return;
      if (uri == 'dart:ffi' || uri == 'package:ffi/ffi.dart') {
        reporter.atNode(node, _code);
      }
    });
  }
}
