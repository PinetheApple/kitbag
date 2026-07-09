#!/usr/bin/env bash
# Eval harness for custom_lint rules.
# Runs lint checks against eval/*.dart scenario files and scores results.
# Conventions:
#   *_pass.dart — must NOT trigger any lint rule
#   *_fail.dart — must trigger at least one lint rule
#   PascalCaseFileFail.dart — must trigger kitbag_naming_convention (offset-0 diagnostic)
set -uo pipefail

repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
eval_dir="$repo_root/packages/app_shell/eval"

echo "=== Kitbag Lint Eval ==="
echo ""

cd "$repo_root/packages/app_shell"

raw=$(dart run custom_lint --no-fatal-infos --no-fatal-warnings --format=json 2>&1)
output=$(echo "$raw" | tail -1)

pass=0
fail=0

echo "Scenario results:"
echo ""

for file in "$eval_dir"/*.dart; do
  fname="$(basename "$file")"
  fpath_full=$(readlink -f "$file")

  # Skip test files
  case "$fname" in test_*.dart) continue ;; esac

  # Extract actual diagnostics for this file from JSON
  actual_codes=$(echo "$output" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if not isinstance(data, dict): data = {'diagnostics': data}
results = []
for d in data.get('diagnostics', []):
    fp = d.get('location', {}).get('file', '')
    code = d.get('code', '')
    if code and fp == '$fpath_full':
        results.append(code)
print(' '.join(results))
")

  # Classify scenario
  status="PASS"
  case "$fname" in
    *_fail.dart)
      hits=0
      for c in $actual_codes; do
        if [ "$c" != "unfulfilled_expect_lint" ]; then ((hits++)); fi
      done
      [ "$hits" -eq 0 ] && status="FAIL"
      ;;
    *_pass.dart)
      hits=0
      for c in $actual_codes; do
        if [ "$c" != "unfulfilled_expect_lint" ]; then ((hits++)); fi
      done
      [ "$hits" -gt 0 ] && status="FAIL"
      ;;
    PascalCaseFileFail.dart)
      hits=0
      for c in $actual_codes; do
        if [ "$c" = "kitbag_naming_convention" ]; then ((hits++)); fi
      done
      [ "$hits" -eq 0 ] && status="FAIL"
      ;;
  esac

  if [ "$status" = "PASS" ]; then
    ((pass++))
    echo "  PASS  $fname"
  else
    ((fail++))
    echo "  FAIL  $fname [codes: $actual_codes]"
  fi
done

echo ""
echo "=== Summary ==="
echo "  Pass: $pass"
echo "  Fail: $fail"
echo "  Total: $((pass + fail))"
echo ""

[ "$fail" -gt 0 ] && exit 1
exit 0
