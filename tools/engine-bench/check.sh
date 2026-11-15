#!/bin/sh
# tools/engine-bench/check.sh — every engine test; exits non-zero on any failure. Use before every commit:
#   sh tools/engine-bench/check.sh && git commit ...
set -e
cd "$(dirname "$0")/../.."
node tests/engine-v2/run.js | tail -1
out=$(node --test tests/engine-v2/*.test.mjs 2>&1) || { echo "$out" | grep -E "^not ok|error:" | head -20; echo "ENGINE TESTS FAILED"; exit 1; }
echo "$out" | grep -E "^# (pass|fail|todo)" | tr '\n' ' '; echo
