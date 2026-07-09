import 'package:analyzer/error/listener.dart';
import 'package:custom_lint_builder/custom_lint_builder.dart';

class LayerBoundaryRule extends DartLintRule {
  LayerBoundaryRule() : super(code: _code);

  static final _code = LintCode(
    name: 'kitbag_layer_boundary',
    problemMessage:
        'core_plugin_api must not import app_shell or tool packages',
    correctionMessage:
        'Move the dependency to a lower-level package or use dependency injection.',
  );

  @override
  void run(
    CustomLintResolver resolver,
    // ignore: deprecated_member_use
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    final sourcePath = resolver.source.uri.toString();
    if (!sourcePath.contains('/packages/core_plugin_api/')) return;

    context.registry.addImportDirective((node) {
      final uri = node.uri.stringValue;
      if (uri == null) return;
      if (uri.startsWith('package:app_shell') ||
          uri.startsWith('package:tool_')) {
        reporter.atNode(node, _code);
      }
    });
  }
}
