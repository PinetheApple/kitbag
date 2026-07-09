import 'package:analyzer/error/listener.dart';
import 'package:custom_lint_builder/custom_lint_builder.dart';

class NamingConventionRule extends DartLintRule {
  NamingConventionRule() : super(code: _code);

  static final _code = LintCode(
    name: 'kitbag_naming_convention',
    problemMessage:
        'File names must use snake_case and classes must use PascalCase',
  );

  @override
  void run(
    CustomLintResolver resolver,
    // ignore: deprecated_member_use
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    final sourcePath = resolver.source.uri.toString();
    final fileName = sourcePath.split('/').last;

    if (!fileName.contains('.')) return;

    final nameWithoutExt = fileName.split('.').first;
    if (nameWithoutExt.contains(RegExp(r'[A-Z]'))) {
      reporter.atOffset(
        diagnosticCode: _code,
        offset: 0,
        length: 1,
      );
    }

    context.registry.addClassDeclaration((node) {
      final className = node.name.lexeme;
      if (className.startsWith(RegExp(r'[a-z]'))) {
        reporter.atNode(node, _code);
      }
    });
  }
}
