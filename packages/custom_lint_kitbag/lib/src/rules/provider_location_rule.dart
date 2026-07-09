import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/error/listener.dart';
import 'package:custom_lint_builder/custom_lint_builder.dart';

class ProviderLocationRule extends DartLintRule {
  ProviderLocationRule() : super(code: _code);

  static final _code = LintCode(
    name: 'kitbag_provider_location',
    problemMessage: 'Riverpod providers must be defined in packages/core_services',
    correctionMessage:
        'Move the provider definition to packages/core_services.',
  );

  static const _providerNames = [
    'Provider',
    'FutureProvider',
    'StreamProvider',
    'StateProvider',
    'StateNotifierProvider',
    'NotifierProvider',
    'AsyncNotifierProvider',
    'ChangeNotifierProvider',
  ];

  @override
  void run(
    CustomLintResolver resolver,
    // ignore: deprecated_member_use
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    final sourcePath = resolver.source.uri.toString();
    if (sourcePath.contains('/packages/core_services/')) return;

    context.registry.addTopLevelVariableDeclaration((node) {
      for (final variable in node.variables.variables) {
        final initializer = variable.initializer;
        if (initializer == null) continue;

        String? functionName;
        if (initializer is FunctionExpressionInvocation) {
          final func = initializer.function;
          if (func is SimpleIdentifier) {
            functionName = func.name;
          } else if (func is PrefixedIdentifier) {
            functionName = func.identifier.name;
          }
        } else if (initializer is InstanceCreationExpression) {
          final constructorName = initializer.constructorName;
          functionName = constructorName.type.name.lexeme;
        }

        if (functionName != null &&
            _providerNames.any(functionName.endsWith)) {
          reporter.atNode(variable, _code);
        }
      }
    });
  }
}
