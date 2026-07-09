import 'package:custom_lint_builder/custom_lint_builder.dart';

import 'rules/ffi_boundary_rule.dart';
import 'rules/layer_boundary_rule.dart';
import 'rules/naming_convention_rule.dart';
import 'rules/provider_location_rule.dart';

class KitbagPlugin extends PluginBase {
  @override
  List<LintRule> getLintRules(CustomLintConfigs configs) => [
        LayerBoundaryRule(),
        FfiBoundaryRule(),
        ProviderLocationRule(),
        NamingConventionRule(),
      ];
}
