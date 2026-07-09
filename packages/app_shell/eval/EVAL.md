# Eval scenarios for custom_lint rules

Each `eval/*.dart` file tests one or more lint rule scenarios.
`// expect_lint: rule_name` marks where a diagnostic is expected.
Files without `// expect_lint` are expected to pass cleanly.

Run `bash packages/app_shell/eval/run.sh` from workspace root to score.
