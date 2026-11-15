#!/bin/bash
# usage: runall.sh <outfile>
cd /workspace/wt-engine-gaps-15nov
OUT=$1; : > $OUT
for t in tests/engine-v2/*.test.mjs tests/safety/*.test.mjs; do node --test $t > /tmp/t.log 2>&1; rc=$?; echo "== $t rc=$rc $(grep -E '^ℹ (pass|fail) ' /tmp/t.log | tr '\n' ' ')" >> $OUT; [ $rc != 0 ] && grep -E "^not ok|✖" /tmp/t.log | head -8 >> $OUT; done
node tests/engine-v2/run.js > /tmp/t.log 2>&1; echo "== engine-v2/run.js rc=$? $(tail -1 /tmp/t.log)" >> $OUT
for t in tests/*.mjs tests/perf/*.mjs; do timeout 300 node $t > /tmp/t.log 2>&1; rc=$?; echo "== $t rc=$rc $(tail -1 /tmp/t.log|cut -c1-160)" >> $OUT; [ $rc != 0 ] && tail -8 /tmp/t.log >> $OUT; done
(cd cloudflare && npm test > /tmp/cf.log 2>&1); rc=$?; echo "== cf-test rc=$rc $(grep -E '^ℹ (tests|pass|fail) ' /tmp/cf.log | tr '\n' ' ')" >> $OUT; [ $rc != 0 ] && grep -E "^not ok|✖" /tmp/cf.log | head -20 >> $OUT
node tools/vbump.mjs --check > /tmp/t.log 2>&1; echo "== vbump-check rc=$? $(tail -1 /tmp/t.log)" >> $OUT
node tools/perf-budget.mjs > /tmp/t.log 2>&1; echo "== perf-budget rc=$? $(grep -A3 FAILED /tmp/t.log | tr '\n' ' ')" >> $OUT
bad=0; for f in $(git diff --name-only 6ab1b7af1 -- '*.js' '*.mjs'; git ls-files -o --exclude-standard -- '*.js' '*.mjs' | grep -v node_modules); do [ -f "$f" ] && { node --check "$f" 2>/dev/null || { echo "node-check FAIL $f" >> $OUT; bad=$((bad+1)); }; }; done
echo "== node-check bad=$bad" >> $OUT
