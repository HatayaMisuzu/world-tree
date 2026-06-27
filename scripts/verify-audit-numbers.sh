#!/usr/bin/env bash
# scripts/verify-audit-numbers.sh
# Verify audit report numbers against the current local checkout.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

count_or_zero() {
  local pattern="$1"
  # shellcheck disable=SC2086
  find $pattern 2>/dev/null | wc -l | tr -d ' '
}

echo "===== 1. 文件计数 ====="
echo "src/core JS files:        $(find src/core -name '*.js' | wc -l | tr -d ' ')        [审计: 382]"
echo "tests/unit files:         $(find tests/unit -maxdepth 1 -name '*.test.js' | wc -l | tr -d ' ')           [审计: 130]"
echo "tests/integration files:  $(find tests/integration -maxdepth 1 -name '*.test.js' | wc -l | tr -d ' ')    [审计: 35]"
echo "docs/*.md top-level:      $(find docs -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')"
echo "docs recursive *.md:      $(find docs -name '*.md' | wc -l | tr -d ' ')"
echo "root *.md:                $(find . -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')"
echo "audit/ files:             $(find audit -type f 2>/dev/null | wc -l | tr -d ' ')"
echo "audit/ size:              $(du -sh audit 2>/dev/null | cut -f1 || echo 'N/A')"

echo ""
echo "===== 2. 关键文件行数 ====="
echo "server.js:                $(wc -l < server.js)"
echo "world-tree-console.js:    $(wc -l < world-tree-console.js)"

echo ""
echo "===== 3. test:unit 脚本覆盖 ====="
python3 - <<'PY'
import json, os, re
from pathlib import Path

pkg = json.load(open("package.json", encoding="utf-8"))
script = pkg.get("scripts", {}).get("test:unit", "")
uses_unit_glob = "tests/unit/*.test.js" in script
listed = [] if uses_unit_glob else re.findall(r"tests/unit/[^\s]+\.test\.js", script)
actual = sorted(str(p).replace("\\", "/") for p in Path("tests/unit").glob("*.test.js"))
listed_set = set(actual if uses_unit_glob else listed)
actual_set = set(actual)
missing = sorted(actual_set - listed_set)
nonexistent = sorted(p for p in listed if not os.path.exists(p))

if uses_unit_glob:
    print("test:unit coverage mode:   glob")
else:
    print("test:unit coverage mode:   explicit")
print(f"test:unit listed files:    {len(listed_set)}")
print(f"tests/unit actual files:   {len(actual)}")
print(f"missing from test:unit:    {len(missing)}")
print(f"nonexistent in script:     {len(nonexistent)}")
if missing:
    print("missing sample:")
    for p in missing[:20]:
        print(f"  {p}")
if nonexistent:
    print("nonexistent listed:")
    for p in nonexistent:
        print(f"  {p}")
PY

echo ""
echo "===== 4. creation-forge 状态分裂确认 ====="
echo "[mode-manifest.js]"
grep -A3 '"creation-forge"' src/core/modes/mode-manifest.js | head -5 || true
echo "[world-tree-route-index.js]"
grep -A3 'creation-forge' src/core/system/world-tree-route-index.js | head -5 || true
echo "[mode-capsule-registry.js]"
grep -A3 '"creation-forge"' src/core/modes/mode-capsule-registry.js | head -5 || true
echo "[creation-forge-mode-adapter.js]"
grep 'status' src/core/creation-forge/creation-forge-mode-adapter.js | head -2 || true

echo ""
echo "===== 5. mode-project-factory.js 重复 mystery-puzzle 块 ====="
grep -n 'mode === "mystery-puzzle"' src/core/modes/mode-project-factory.js || true

echo ""
echo "===== 6. 大型 PNG ====="
find design -name "*.png" -size +1M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' || true

echo ""
echo "===== 7. 提示 ====="
echo "test files != test cases/pass."
echo "For pass counts, run:"
echo "  npm run test:unit 2>&1 | grep -E '^# (tests|pass|fail)'"
echo "  npm run test:integration 2>&1 | grep -E '^# (tests|pass|fail)'"
