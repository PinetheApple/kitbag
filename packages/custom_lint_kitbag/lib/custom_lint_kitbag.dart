import 'package:custom_lint_builder/custom_lint_builder.dart';

import 'src/kitbag_plugin.dart';

PluginBase createPlugin() {
  print('KITBAG LINT PLUGIN LOADED');
  return KitbagPlugin();
}
