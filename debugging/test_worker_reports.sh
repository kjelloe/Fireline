#!/bin/bash
# debugging/test_worker_reports.sh - prove the batch_worker report mailer
# (prompt 73). It runs unattended on the gaming PC, and a dedup bug there
# either spams the mail store every job or silently never ships results,
# so it gets tested here.
#
# The worker's top level does real work (git describe, npm test), so the
# functions are extracted rather than sourced, and $AM is stubbed to
# record calls instead of sending mail.
#
#   bash debugging/test_worker_reports.sh
set -u
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { # label expected actual
  if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1));
  else echo "  FAIL $1: expected '$2', got '$3'"; fail=$((fail+1)); fi
}

# --- stub the mail CLI: every send appends the tag + file name ---------
mkdir -p "$TMP/bin"
cat > "$TMP/bin/fake-am" <<'STUB'
#!/bin/bash
tag=""; body=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) tag=$2; shift 2 ;;
    --body-file) body=$2; shift 2 ;;
    *) shift ;;
  esac
done
if [ -n "$body" ]; then
  echo "$tag $(head -1 "$body" | sed 's/^#file://')" >> "$SENTLOG"
fi
STUB
chmod +x "$TMP/bin/fake-am"

# --- extract the report-mailing functions from the worker -------------
awk '/^MANIFEST=/,/^}$/ { print }
     /^mail_csv\(\)/ { print }
     /^mail_reports\(\)/,/^}$/ { print }' tools/batch_worker.sh > "$TMP/funcs.sh"
grep -q 'mail_file()' "$TMP/funcs.sh" || { echo "extraction failed"; exit 1; }

export SENTLOG="$TMP/sent.log"
: > "$SENTLOG"
OUT="$TMP/reports"
mkdir -p "$OUT"
AM="$TMP/bin/fake-am"
ME=batch-pc
# shellcheck disable=SC1090
. "$TMP/funcs.sh"

sent_count() { wc -l < "$SENTLOG" | tr -d ' '; }

echo "case 1: a new report is mailed, an unchanged one is not"
printf 'seed,winner\n1,0\n' > "$OUT/sweep.csv"
printf '{"fps":144}\n' > "$OUT/perf_summary.json"
n=$(mail_reports)
check "both new files mailed" "2" "$n"
check "csv tagged csv" "1" "$(grep -c '^csv sweep.csv$' "$SENTLOG")"
check "json tagged report" "1" "$(grep -c '^report perf_summary.json$' "$SENTLOG")"
n=$(mail_reports)
check "second pass mails nothing" "0" "$n"
check "no extra sends" "2" "$(sent_count)"

echo "case 2: a CHANGED report is mailed again"
sleep 1
printf '{"fps":144,"p5":92}\n' > "$OUT/perf_summary.json"
n=$(mail_reports)
check "changed file re-mailed" "1" "$n"
check "manifest keeps ONE line per file" "1" \
  "$(grep -c '^perf_summary.json|' "$OUT/.mailed")"

echo "case 3: FORCE re-sends everything (the sendresults path)"
before=$(sent_count)
n=$(FORCE=1 mail_reports)
check "force re-mails all reports" "2" "$n"
check "sends actually happened" "$((before + 2))" "$(sent_count)"

echo "case 4: a native perf run dropped by hand is picked up"
printf '{"gl":"NVIDIA RTX 4070","medianFps":240}\n' > "$OUT/perf_native_20260729-1200.json"
n=$(mail_reports)
check "the stamped native report goes home" "1" "$n"
check "it is tagged report" "1" \
  "$(grep -c '^report perf_native_20260729-1200.json$' "$SENTLOG")"

echo "case 5: a missing file is not an error"
mail_file "$OUT/nope.json" report && rc=0 || rc=1
check "missing file returns non-zero, does not send" "1" "$rc"

echo
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
